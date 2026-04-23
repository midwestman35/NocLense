import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';

const FILE_CHUNK_EVENT = 'file-chunk';
const FILE_CHUNK_ACK_EVENT = 'file-chunk-ack';
const FILE_CHUNK_ERROR_EVENT = 'file-chunk-error';

export interface FileStreamHandle {
  streamId: string;
  totalBytes: number;
}

interface FileChunkPayload {
  streamId: string;
  offset: number;
  bytesBase64: string;
  isLast: boolean;
}

interface FileChunkErrorPayload {
  streamId: string;
  message: string;
}

export interface StreamedTextChunk {
  offset: number;
  text: string;
  byteLength: number;
  isLast: boolean;
}

function decodeBase64Bytes(value: string): Uint8Array {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

class FileStreamService {
  async streamTextChunks(
    path: string,
    chunkSizeBytes: number,
    onChunk: (chunk: StreamedTextChunk) => Promise<void> | void,
  ): Promise<FileStreamHandle> {
    const decoder = new TextDecoder();
    let streamId: string | null = null;
    let resolveDone!: () => void;
    let rejectDone!: (error: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    const queuedChunks: FileChunkPayload[] = [];
    const queuedErrors: FileChunkErrorPayload[] = [];

    const processChunk = async (payload: FileChunkPayload) => {
      const bytes = decodeBase64Bytes(payload.bytesBase64);
      const text = decoder.decode(bytes, { stream: !payload.isLast });
      await onChunk({
        offset: payload.offset,
        text,
        byteLength: bytes.byteLength,
        isLast: payload.isLast,
      });
      await emit(FILE_CHUNK_ACK_EVENT, {
        streamId: payload.streamId,
        offset: payload.offset,
      });

      if (payload.isLast) {
        resolveDone();
      }
    };

    const processError = (payload: FileChunkErrorPayload) => {
      rejectDone(new Error(payload.message));
    };

    const unlistenChunk = await listen<FileChunkPayload>(FILE_CHUNK_EVENT, (event) => {
      const payload = event.payload;
      if (streamId === null) {
        queuedChunks.push(payload);
        return;
      }
      if (payload.streamId !== streamId) {
        return;
      }
      void processChunk(payload).catch(rejectDone);
    });

    const unlistenError = await listen<FileChunkErrorPayload>(FILE_CHUNK_ERROR_EVENT, (event) => {
      const payload = event.payload;
      if (streamId === null) {
        queuedErrors.push(payload);
        return;
      }
      if (payload.streamId !== streamId) {
        return;
      }
      processError(payload);
    });

    try {
      const handle = await invoke<FileStreamHandle>('stream_file_chunks', {
        path,
        chunkSizeKb: Math.max(1, Math.ceil(chunkSizeBytes / 1024)),
      });
      streamId = handle.streamId;

      for (const payload of queuedErrors) {
        if (payload.streamId === streamId) {
          processError(payload);
          break;
        }
      }

      for (const payload of queuedChunks) {
        if (payload.streamId === streamId) {
          await processChunk(payload);
        }
      }

      if (handle.totalBytes === 0) {
        resolveDone();
      }

      await done;
      return handle;
    } finally {
      unlistenChunk();
      unlistenError();
    }
  }
}

export const fileStream = new FileStreamService();
