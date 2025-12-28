use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use sha2::{Digest, Sha256};
use base64::Engine;

/// 加密文本
#[tauri::command]
pub fn encrypt_text(plaintext: String, password: String) -> Result<String, String> {
    // 从密码生成密钥
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let key_bytes = hasher.finalize();

    // 将密钥转换为 AES-256 密钥
    let cipher = Aes256Gcm::new(&key_bytes.into());

    // 生成随机 nonce
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    // 加密数据
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes().as_ref())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // 组合 nonce 和密文，然后 base64 编码
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    let encoded = base64::engine::general_purpose::STANDARD.encode(combined);

    Ok(encoded)
}

/// 解密文本
#[tauri::command]
pub fn decrypt_text(encoded: String, password: String) -> Result<String, String> {
    // 从密码生成密钥
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let key_bytes = hasher.finalize();

    // 将密钥转换为 AES-256 密钥
    let cipher = Aes256Gcm::new(&key_bytes.into());

    // Base64 解码
    let combined = base64::engine::general_purpose::STANDARD
        .decode(&encoded)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    // 分离 nonce 和密文
    if combined.len() < 12 {
        return Err("Invalid data: too short".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    // 解密数据
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode failed: {}", e))
}
