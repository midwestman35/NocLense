mod commands;

use tauri::{Listener, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::file_stream::FileChunkStreamState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::crash_reporting::report_runtime_error,
            commands::file_stream::stream_file_chunks,
            commands::keyring::keyring_get,
            commands::keyring::keyring_set,
            commands::keyring::keyring_delete,
            commands::keyring::keyring_list,
            commands::keyring::keyring_is_available,
            commands::keyring::legacy_secure_storage_read,
        ])
        .setup(|app| {
            let file_chunk_state = app.state::<commands::file_stream::FileChunkStreamState>().inner().clone();
            app.listen_any(commands::file_stream::FILE_CHUNK_ACK_EVENT, move |event| {
                if let Err(error) = file_chunk_state.handle_ack_payload(event.payload()) {
                    log::warn!("invalid file chunk ack payload: {error}");
                }
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
