use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter, State};

pub const FILE_CHUNK_EVENT: &str = "file-chunk";
pub const FILE_CHUNK_ACK_EVENT: &str = "file-chunk-ack";

#[derive(Clone, Default)]
pub struct FileChunkStreamState {
    inner: Arc<FileChunkStreamStateInner>,
}

#[derive(Default)]
struct FileChunkStreamStateInner {
    next_stream_id: AtomicU64,
    waiters: Mutex<HashMap<String, Arc<AckWaiter>>>,
}

struct AckWaiter {
    acked: Mutex<bool>,
    ready: Condvar,
}

impl Default for AckWaiter {
    fn default() -> Self {
        Self {
            acked: Mutex::new(false),
            ready: Condvar::new(),
        }
    }
}

impl AckWaiter {
    fn acknowledge(&self) -> Result<(), String> {
        let mut acked = self.acked.lock().map_err(|error| error.to_string())?;
        *acked = true;
        self.ready.notify_all();
        Ok(())
    }

    fn wait_for_ack(&self) -> Result<(), String> {
        let mut acked = self.acked.lock().map_err(|error| error.to_string())?;
        while !*acked {
            acked = self.ready.wait(acked).map_err(|error| error.to_string())?;
        }
        Ok(())
    }
}

impl FileChunkStreamState {
    pub fn handle_ack_payload(&self, payload: &str) -> Result<(), String> {
        let ack: FileChunkAckPayload = serde_json::from_str(payload).map_err(|error| error.to_string())?;
        self.acknowledge(&ack.stream_id, ack.offset)
    }

    fn next_stream_id(&self) -> String {
        let stream_number = self.inner.next_stream_id.fetch_add(1, Ordering::Relaxed) + 1;
        format!("file-stream-{stream_number}")
    }

    fn register_waiter(&self, stream_id: &str, offset: u64) -> Result<Arc<AckWaiter>, String> {
        let key = waiter_key(stream_id, offset);
        let waiter = Arc::new(AckWaiter::default());
        let mut waiters = self.inner.waiters.lock().map_err(|error| error.to_string())?;
        waiters.insert(key, waiter.clone());
        Ok(waiter)
    }

    fn clear_waiter(&self, stream_id: &str, offset: u64) -> Result<(), String> {
        let key = waiter_key(stream_id, offset);
        let mut waiters = self.inner.waiters.lock().map_err(|error| error.to_string())?;
        waiters.remove(&key);
        Ok(())
    }

    fn acknowledge(&self, stream_id: &str, offset: u64) -> Result<(), String> {
        let key = waiter_key(stream_id, offset);
        let waiter = {
            let mut waiters = self.inner.waiters.lock().map_err(|error| error.to_string())?;
            waiters.remove(&key)
        };

        if let Some(waiter) = waiter {
            waiter.acknowledge()?;
        }

        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileChunkAckPayload {
    stream_id: String,
    offset: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamFileChunksResponse {
    pub stream_id: String,
    pub total_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileChunkPayload {
    stream_id: String,
    offset: u64,
    bytes_base64: String,
    is_last: bool,
}

#[command]
pub fn stream_file_chunks(
    path: String,
    chunk_size_kb: u32,
    app: AppHandle,
    state: State<'_, FileChunkStreamState>,
) -> Result<StreamFileChunksResponse, String> {
    let chunk_size_bytes = chunk_size_from_kb(chunk_size_kb)?;
    let file = File::open(&path).map_err(|error| error.to_string())?;
    let total_bytes = file.metadata().map_err(|error| error.to_string())?.len();
    let stream_id = state.next_stream_id();

    let worker_state = state.inner().clone();
    let worker_app = app.clone();
    let worker_stream_id = stream_id.clone();

    std::thread::spawn(move || {
        if let Err(error) = stream_file_chunks_worker(
            file,
            chunk_size_bytes,
            total_bytes,
            worker_stream_id.clone(),
            worker_app,
            worker_state,
        ) {
            log::error!("stream_file_chunks failed for {worker_stream_id}: {error}");
        }
    });

    Ok(StreamFileChunksResponse {
        stream_id,
        total_bytes,
    })
}

fn stream_file_chunks_worker(
    file: File,
    chunk_size_bytes: usize,
    total_bytes: u64,
    stream_id: String,
    app: AppHandle,
    state: FileChunkStreamState,
) -> Result<(), String> {
    let mut reader = BufReader::with_capacity(chunk_size_bytes, file);
    let mut buffer = vec![0; chunk_size_bytes];
    let mut offset = 0_u64;
    let mut emitted_any = false;

    loop {
        let read = reader.read(&mut buffer).map_err(|error| error.to_string())?;

        if read == 0 {
            if !emitted_any {
                emit_chunk(
                    &app,
                    FileChunkPayload {
                        stream_id,
                        offset: 0,
                        bytes_base64: String::new(),
                        is_last: true,
                    },
                )?;
            }
            return Ok(());
        }

        emitted_any = true;
        let bytes_base64 = BASE64.encode(&buffer[..read]);
        let next_offset = offset + read as u64;
        let is_last = next_offset >= total_bytes;

        if is_last {
            emit_chunk(
                &app,
                FileChunkPayload {
                    stream_id,
                    offset,
                    bytes_base64,
                    is_last: true,
                },
            )?;
            return Ok(());
        }

        let waiter = state.register_waiter(&stream_id, offset)?;
        let emit_result = emit_chunk(
            &app,
            FileChunkPayload {
                stream_id: stream_id.clone(),
                offset,
                bytes_base64,
                is_last: false,
            },
        );

        if let Err(error) = emit_result {
            let _ = state.clear_waiter(&stream_id, offset);
            return Err(error);
        }

        let wait_result = waiter.wait_for_ack();
        let _ = state.clear_waiter(&stream_id, offset);
        wait_result?;

        offset = next_offset;
    }
}

fn chunk_size_from_kb(chunk_size_kb: u32) -> Result<usize, String> {
    if chunk_size_kb == 0 {
        return Err("chunk_size_kb must be greater than 0".to_string());
    }

    let chunk_size_bytes = chunk_size_kb
        .checked_mul(1024)
        .ok_or_else(|| "chunk_size_kb is too large".to_string())?;

    Ok(chunk_size_bytes as usize)
}

fn emit_chunk(app: &AppHandle, payload: FileChunkPayload) -> Result<(), String> {
    app.emit(FILE_CHUNK_EVENT, payload)
        .map_err(|error| error.to_string())
}

fn waiter_key(stream_id: &str, offset: u64) -> String {
    format!("{stream_id}:{offset}")
}
