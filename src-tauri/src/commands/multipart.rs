use crate::s3::types::S3Config;
use crate::s3::client::S3Client;
use aws_sdk_s3::types::CompletedMultipartUpload;
use aws_sdk_s3::types::CompletedPart;
use tokio::io::AsyncReadExt;
use tokio::fs::File;

/// 分片上传
#[tauri::command]
pub async fn upload_multipart(
    config: S3Config,
    bucket: String,
    key: String,
    file_path: String,
    part_size_mb: Option<usize>,
) -> Result<String, String> {
    let client = S3Client::new(config.clone()).await.map_err(|e| e.to_string())?;

    // 默认每片 5MB
    let part_size = part_size_mb.unwrap_or(5) * 1024 * 1024;

    // 获取文件大小
    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len() as usize;

    // 如果文件小于 5MB，直接使用普通上传
    if file_size < 5 * 1024 * 1024 {
        return super::upload::upload_file(config.clone(), bucket, key, file_path, None).await;
    }

    // 1. 创建分片上传
    let upload_id = client
        .client()
        .create_multipart_upload()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("Failed to create multipart upload: {}", e))?
        .upload_id()
        .ok_or("Failed to get upload id")?
        .to_string();

    // 2. 读取文件并分片上传
    let mut file = File::open(&file_path)
        .await
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut part_number = 1;
    let mut completed_parts = Vec::new();
    let mut position = 0;

    while position < file_size {
        let remaining = file_size - position;
        let chunk_size = std::cmp::min(part_size, remaining);

        let mut buffer = vec![0u8; chunk_size];
        let _bytes_read = file
            .read_exact(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read file chunk: {}", e))?;

        // 上传分片
        let upload_result = client
            .client()
            .upload_part()
            .bucket(&bucket)
            .key(&key)
            .upload_id(&upload_id)
            .part_number(part_number as i32)
            .body(aws_sdk_s3::primitives::ByteStream::from(buffer))
            .send()
            .await
            .map_err(|e| format!("Failed to upload part {}: {}", part_number, e))?;

        let etag = upload_result
            .e_tag()
            .ok_or("Failed to get ETag")?
            .to_string();

        completed_parts.push(
            CompletedPart::builder()
                .part_number(part_number as i32)
                .e_tag(etag)
                .build()
        );

        part_number += 1;
        position += chunk_size;
    }

    // 3. 完成分片上传
    let completed_upload = CompletedMultipartUpload::builder()
        .set_parts(Some(completed_parts))
        .build();

    client
        .client()
        .complete_multipart_upload()
        .bucket(&bucket)
        .key(&key)
        .upload_id(&upload_id)
        .multipart_upload(completed_upload)
        .send()
        .await
        .map_err(|e| format!("Failed to complete multipart upload: {}", e))?;

    Ok(key)
}

/// 取消分片上传
#[tauri::command]
pub async fn abort_multipart_upload(
    config: S3Config,
    bucket: String,
    key: String,
    upload_id: String,
) -> Result<(), String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    client
        .client()
        .abort_multipart_upload()
        .bucket(&bucket)
        .key(&key)
        .upload_id(&upload_id)
        .send()
        .await
        .map_err(|e| format!("Failed to abort multipart upload: {}", e))?;

    Ok(())
}
