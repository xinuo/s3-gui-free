use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// S3 连接配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Config {
    pub id: String,
    pub name: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub region: Option<String>,
    pub endpoint: Option<String>,
    pub session_token: Option<String>,
    pub bucket: Option<String>,
}

/// Bucket 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BucketInfo {
    pub name: String,
    pub creation_date: String,
    pub region: Option<String>,
}

/// Object 元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectMetadata {
    pub key: String,
    pub last_modified: String,
    pub size: i64,
    pub etag: String,
    pub storage_class: String,
    pub content_type: Option<String>,
    pub is_folder: bool,
}

/// 列出 Objects 结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListObjectsResult {
    pub objects: Vec<ObjectMetadata>,
    pub common_prefixes: Vec<String>,
    pub is_truncated: bool,
    pub next_continuation_token: Option<String>,
}

/// 上传进度信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadProgress {
    pub key: String,
    pub uploaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
}

/// 下载进度信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub key: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
}

/// 错误类型
#[derive(Debug, thiserror::Error)]
pub enum S3Error {
    #[error("AWS SDK error: {0}")]
    AwsError(#[from] aws_sdk_s3::Error),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    SerdeError(#[from] serde_json::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl Serialize for S3Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
