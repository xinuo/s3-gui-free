use crate::s3::types::{ListObjectsResult, ObjectMetadata, S3Config};
use crate::s3::client::S3Client;

/// 列出 Objects
#[tauri::command]
pub async fn list_objects(
    config: S3Config,
    bucket: String,
    prefix: Option<String>,
    delimiter: Option<String>,
    continuation_token: Option<String>,
    max_keys: Option<i32>,
) -> Result<ListObjectsResult, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    let mut builder = client
        .client()
        .list_objects_v2()
        .bucket(&bucket)
        .set_prefix(prefix);

    if let Some(d) = delimiter {
        builder = builder.delimiter(d);
    }

    if let Some(token) = continuation_token {
        builder = builder.continuation_token(token);
    }

    if let Some(keys) = max_keys {
        builder = builder.max_keys(keys);
    }

    let result = builder
        .send()
        .await
        .map_err(|e| format!("Failed to list objects: {}", e))?;

    let objects = result
        .contents()
        .iter()
        .map(|obj| ObjectMetadata {
            key: obj.key().unwrap_or("").to_string(),
            last_modified: obj
                .last_modified()
                .map(|d| format!("{:?}", d))
                .unwrap_or_default(),
            size: obj.size().unwrap_or(0) as i64,
            etag: obj.e_tag().unwrap_or("").to_string(),
            storage_class: obj
                .storage_class()
                .map(|s| s.as_str().to_string())
                .unwrap_or_default(),
            content_type: None,
            is_folder: false,
        })
        .collect();

    let common_prefixes = result
        .common_prefixes()
        .iter()
        .filter_map(|p| p.prefix().map(|s| s.to_string()))
        .collect();

    Ok(ListObjectsResult {
        objects,
        common_prefixes,
        is_truncated: result.is_truncated().unwrap_or(false),
        next_continuation_token: result.next_continuation_token().map(|s| s.to_string()),
    })
}

/// 删除 Object
#[tauri::command]
pub async fn delete_object(
    config: S3Config,
    bucket: String,
    key: String,
) -> Result<(), String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    client
        .client()
        .delete_object()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("Failed to delete object: {}", e))?;

    Ok(())
}

/// 批量删除 Objects
#[tauri::command]
pub async fn delete_objects(
    config: S3Config,
    bucket: String,
    keys: Vec<String>,
) -> Result<Vec<String>, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    use aws_sdk_s3::types::ObjectIdentifier;

    let delete_objects: Vec<ObjectIdentifier> = keys
        .iter()
        .map(|key| ObjectIdentifier::builder().key(key).build().unwrap())
        .collect();

    let result = client
        .client()
        .delete_objects()
        .bucket(&bucket)
        .delete(
            aws_sdk_s3::types::Delete::builder()
                .set_objects(Some(delete_objects))
                .build()
                .map_err(|e| e.to_string())?,
        )
        .send()
        .await
        .map_err(|e| format!("Failed to delete objects: {}", e))?;

    // 返回删除失败的对象
    let errors = result
        .errors()
        .iter()
        .map(|e| e.key().unwrap_or("").to_string())
        .collect();

    Ok(errors)
}

/// 复制 Object
#[tauri::command]
pub async fn copy_object(
    config: S3Config,
    bucket: String,
    source_key: String,
    dest_key: String,
) -> Result<(), String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    client
        .client()
        .copy_object()
        .bucket(&bucket)
        .copy_source(format!("{}/{}", bucket, source_key))
        .key(&dest_key)
        .send()
        .await
        .map_err(|e| format!("Failed to copy object: {}", e))?;

    Ok(())
}

/// 获取 Object 元数据
#[tauri::command]
pub async fn head_object(
    config: S3Config,
    bucket: String,
    key: String,
) -> Result<ObjectMetadata, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    let result = client
        .client()
        .head_object()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| format!("Failed to head object: {}", e))?;

    Ok(ObjectMetadata {
        key,
        last_modified: result
            .last_modified()
            .map(|d| format!("{:?}", d))
            .unwrap_or_default(),
        size: result.content_length().unwrap_or(0) as i64,
        etag: result.e_tag().unwrap_or("").to_string(),
        storage_class: result
            .storage_class()
            .map(|s| s.as_str().to_string())
            .unwrap_or_default(),
        content_type: result.content_type().map(|s| s.to_string()),
        is_folder: false,
    })
}

/// 移动/重命名 Object（通过复制+删除实现）
#[tauri::command]
pub async fn move_object(
    config: S3Config,
    bucket: String,
    source_key: String,
    dest_key: String,
) -> Result<(), String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    // 先复制
    client
        .client()
        .copy_object()
        .bucket(&bucket)
        .copy_source(format!("{}/{}", bucket, source_key))
        .key(&dest_key)
        .send()
        .await
        .map_err(|e| format!("Failed to copy object during move: {}", e))?;

    // 再删除源文件
    client
        .client()
        .delete_object()
        .bucket(&bucket)
        .key(&source_key)
        .send()
        .await
        .map_err(|e| format!("Failed to delete source object during move: {}", e))?;

    Ok(())
}

/// 重命名 Object（移动的别名）
#[tauri::command]
pub async fn rename_object(
    config: S3Config,
    bucket: String,
    old_key: String,
    new_key: String,
) -> Result<(), String> {
    move_object(config, bucket, old_key, new_key).await
}
