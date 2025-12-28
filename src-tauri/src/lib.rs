mod commands;
mod s3;

use s3::ConfigManager;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_manager = ConfigManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(config_manager))
        .invoke_handler(tauri::generate_handler![
            // Bucket commands
            commands::list_buckets,
            commands::create_bucket,
            commands::delete_bucket,
            commands::head_bucket,
            // Object commands
            commands::list_objects,
            commands::delete_object,
            commands::delete_objects,
            commands::copy_object,
            commands::move_object,
            commands::rename_object,
            commands::head_object,
            // Upload commands
            commands::upload_file,
            commands::upload_files,
            commands::upload_multipart,
            commands::abort_multipart_upload,
            // Download commands
            commands::download_file,
            commands::download_files,
            commands::get_file_content,
            commands::get_file_bytes,
            // Security commands
            commands::encrypt_text,
            commands::decrypt_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
