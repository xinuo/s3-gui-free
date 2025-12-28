use crate::s3::types::{BucketInfo, S3Config};
use crate::s3::client::S3Client;

/// 列出所有 Buckets
#[tauri::command]
pub async fn list_buckets(config: S3Config) -> Result<Vec<BucketInfo>, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    let result = client
        .client()
        .list_buckets()
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let buckets = result
        .buckets()
        .iter()
        .map(|b| BucketInfo {
            name: b.name().unwrap_or("").to_string(),
            creation_date: b
                .creation_date()
                .map(|d| format!("{:?}", d))
                .unwrap_or_default(),
            region: None,
        })
        .collect();

    Ok(buckets)
}

/// 创建 Bucket
#[tauri::command]
pub async fn create_bucket(
    config: S3Config,
    bucket_name: String,
    region: Option<String>,
) -> Result<(), String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    let mut builder = client
        .client()
        .create_bucket()
        .bucket(&bucket_name);

    // 如果不是 us-east-1，需要指定 location constraint
    if let Some(ref r) = region {
        if r != "us-east-1" {
            use aws_sdk_s3::types::CreateBucketConfiguration;
            let config = CreateBucketConfiguration::builder()
                .location_constraint(r.as_str().into())
                .build();
            builder = builder.create_bucket_configuration(config);
        }
    }

    builder.send().await.map_err(|e| format!("Failed to create bucket: {}", e))?;

    Ok(())
}

/// 删除 Bucket
#[tauri::command]
pub async fn delete_bucket(config: S3Config, bucket_name: String) -> Result<(), String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    client
        .client()
        .delete_bucket()
        .bucket(&bucket_name)
        .send()
        .await
        .map_err(|e| format!("Failed to delete bucket: {}", e))?;

    Ok(())
}

/// 检查 Bucket 是否存在
#[tauri::command]
pub async fn head_bucket(config: S3Config, bucket_name: String) -> Result<bool, String> {
    let client = S3Client::new(config).await.map_err(|e| e.to_string())?;

    match client
        .client()
        .head_bucket()
        .bucket(&bucket_name)
        .send()
        .await
    {
        Ok(_) => Ok(true),
        Err(e) => {
            let err = e.into_service_error();
            if err.is_not_found() {
                Ok(false)
            } else {
                Err(format!("Failed to check bucket: {}", err))
            }
        }
    }
}
