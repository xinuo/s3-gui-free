use crate::s3::types::S3Config;
use crate::s3::client::S3Client;
use tokio::io::AsyncReadExt;

/// 上传单个文件
#[tauri::command]
pub async fn upload_file(
    config: S3Config,
    bucket: String,
    key: String,
    file_path: String,
    content_type: Option<String>,
) -> Result<String, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    // 读取文件内容
    let mut file = tokio::fs::File::open(&file_path)
        .await
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut contents = Vec::new();
    file.read_to_end(&mut contents)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let file_name = file_path.rsplit('/').next().unwrap_or("unknown");

    let mut builder = client
        .client()
        .put_object()
        .bucket(&bucket)
        .key(&key)
        .body(aws_sdk_s3::primitives::ByteStream::from(contents));

    if let Some(ct) = content_type {
        builder = builder.content_type(ct);
    } else {
        // 根据文件扩展名猜测 content type
        let mime_type = mime_guess::from_path(file_name)
            .first()
            .map(|m| m.to_string());
        if let Some(mime) = mime_type {
            builder = builder.content_type(mime);
        }
    }

    builder
        .send()
        .await
        .map_err(|e| format!("Failed to upload file: {}", e))?;

    Ok(key)
}

/// 上传多个文件
#[tauri::command]
pub async fn upload_files(
    config: S3Config,
    bucket: String,
    files: Vec<(String, String)>, // (key, file_path)
) -> Result<Vec<String>, String> {
    let mut uploaded_keys = Vec::new();

    for (key, file_path) in files {
        match upload_file(config.clone(), bucket.clone(), key, file_path, None).await {
            Ok(k) => uploaded_keys.push(k),
            Err(e) => {
                return Err(format!("Upload failed for one file: {}", e));
            }
        }
    }

    Ok(uploaded_keys)
}
