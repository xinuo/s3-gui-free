use super::types::{S3Config, S3Error};
use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::config::Region;
use std::sync::Arc;
use tokio::sync::RwLock;

/// S3 配置管理器
pub struct ConfigManager {
    configs: Arc<RwLock<Vec<S3Config>>>,
}

impl ConfigManager {
    pub fn new() -> Self {
        Self {
            configs: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// 添加配置
    pub async fn add_config(&self, config: S3Config) -> Result<(), S3Error> {
        let mut configs = self.configs.write().await;
        configs.push(config);
        Ok(())
    }

    /// 获取所有配置
    pub async fn get_configs(&self) -> Result<Vec<S3Config>, S3Error> {
        let configs = self.configs.read().await;
        Ok(configs.clone())
    }

    /// 根据 ID 获取配置
    pub async fn get_config(&self, id: &str) -> Result<S3Config, S3Error> {
        let configs = self.configs.read().await;
        configs
            .iter()
            .find(|c| c.id == id)
            .cloned()
            .ok_or_else(|| S3Error::NotFound(format!("Config {} not found", id)))
    }

    /// 删除配置
    pub async fn delete_config(&self, id: &str) -> Result<(), S3Error> {
        let mut configs = self.configs.write().await;
        configs.retain(|c| c.id != id);
        Ok(())
    }

    /// 更新配置
    pub async fn update_config(&self, config: S3Config) -> Result<(), S3Error> {
        let mut configs = self.configs.write().await;
        if let Some(existing) = configs.iter_mut().find(|c| c.id == config.id) {
            *existing = config;
            Ok(())
        } else {
            Err(S3Error::NotFound(format!("Config {} not found", config.id)))
        }
    }
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new()
    }
}
