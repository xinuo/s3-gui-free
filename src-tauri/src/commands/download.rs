use crate::s3::types::S3Config;
use crate::s3::client::S3Client;

/// 下载单个文件
#[tauri::command]
pub async fn download_file(
    config: S3Config,
    bucket: String,
    key: String,
    save_path: String,
) -> Result<String, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    let result = client
        .client()
        .get_object()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    let bytes = result
        .body
        .collect()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?
        .into_bytes();

    // 确保目录存在
    if let Some(parent) = std::path::Path::new(&save_path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    tokio::fs::write(&save_path, bytes)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(save_path)
}

/// 下载多个文件
#[tauri::command]
pub async fn download_files(
    config: S3Config,
    bucket: String,
    files: Vec<(String, String)>, // (key, save_path)
) -> Result<Vec<String>, String> {
    let mut downloaded_paths = Vec::new();

    for (key, save_path) in files {
        match download_file(config.clone(), bucket.clone(), key, save_path).await {
            Ok(p) => downloaded_paths.push(p),
            Err(e) => {
                return Err(format!("Download failed for one file: {}", e));
            }
        }
    }

    Ok(downloaded_paths)
}

/// 获取文件内容到内存（用于预览）
#[tauri::command]
pub async fn get_file_content(
    config: S3Config,
    bucket: String,
    key: String,
) -> Result<String, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    let result = client
        .client()
        .get_object()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("Failed to get file content: {}", e))?;

    let bytes = result
        .body
        .collect()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?
        .into_bytes();

    // 尝试将字节转换为 UTF-8 字符串
    String::from_utf8(bytes.to_vec())
        .map_err(|e| format!("File content is not valid UTF-8 text: {}", e))
}

/// 获取文件的二进制数据（Base64 编码，用于图片预览）
#[tauri::command]
pub async fn get_file_bytes(
    config: S3Config,
    bucket: String,
    key: String,
) -> Result<String, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    let result = client
        .client()
        .get_object()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("Failed to get file bytes: {}", e))?;

    let bytes = result
        .body
        .collect()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?
        .into_bytes();

    // 将字节转换为 Base64 编码的字符串
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}
