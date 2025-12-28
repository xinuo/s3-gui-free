use super::types::{S3Config, S3Error};
use aws_config::BehaviorVersion;
use aws_credential_types::{Credentials, provider::ProvideCredentials};
use aws_sdk_s3::{
    Client,
    config::{Builder, Region},
    primitives::ByteStreamError,
};
use std::sync::Arc;
use tokio::sync::RwLock;

/// S3 客户端包装器
pub struct S3Client {
    client: Arc<aws_sdk_s3::Client>,
    config: S3Config,
}

impl S3Client {
    /// 创建新的 S3 客户端
    pub async fn new(config: S3Config) -> Result<Self, S3Error> {
        let credentials = Credentials::new(
            &config.access_key_id,
            &config.secret_access_key,
            config.session_token.clone(),
            None,
            "s3-gui",
        );

        let region = if config.endpoint.is_some() {
            // 自定义 endpoint (如 MinIO)
            Region::new(config.region.as_ref().unwrap_or(&"us-east-1".to_string()).clone())
        } else {
            // AWS S3
            Region::new(config.region.as_ref().unwrap_or(&"us-east-1".to_string()).clone())
        };

        let mut config_builder = aws_sdk_s3::Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(region)
            .credentials_provider(credentials);

        // 如果是自定义 endpoint，设置 endpoint URL
        if let Some(endpoint) = &config.endpoint {
            config_builder = config_builder.endpoint_url(endpoint);
        }

        let sdk_config = config_builder.build();

        let client = Client::from_conf(sdk_config);

        Ok(Self {
            client: Arc::new(client),
            config,
        })
    }

    /// 获取 S3 客户端引用
    pub fn client(&self) -> &aws_sdk_s3::Client {
        &self.client
    }

    /// 获取配置
    pub fn config(&self) -> &S3Config {
        &self.config
    }
}

/// S3 客户端管理器
pub struct S3ClientManager {
    clients: Arc<RwLock<std::collections::HashMap<String, Arc<S3Client>>>>,
}

impl S3ClientManager {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    /// 获取或创建客户端
    pub async fn get_or_create_client(&self, config: S3Config) -> Result<Arc<S3Client>, S3Error> {
        {
            let clients = self.clients.read().await;
            if let Some(client) = clients.get(&config.id) {
                return Ok(client.clone());
            }
        }

        // 创建新客户端
        let client = S3Client::new(config.clone()).await?;
        let mut clients = self.clients.write().await;
        clients.insert(config.id.clone(), Arc::new(client));
        Ok(clients.get(&config.id).unwrap().clone())
    }

    /// 移除客户端
    pub async fn remove_client(&self, id: &str) {
        let mut clients = self.clients.write().await;
        clients.remove(id);
    }
}

impl Default for S3ClientManager {
    fn default() -> Self {
        Self::new()
    }
}
