import { invoke } from '@tauri-apps/api/core'

export const securityService = {
  // 加密文本
  async encrypt(plaintext: string, password: string): Promise<string> {
    return await invoke('encrypt_text', { plaintext, password })
  },

  // 解密文本
  async decrypt(encoded: string, password: string): Promise<string> {
    return await invoke('decrypt_text', { encoded, password })
  },

  // 生成主密码（用于加密配置）
  getMasterPassword(): string {
    // 从环境变量或用户输入获取主密码
    // 这里使用一个简单的实现，实际应用中应该从用户输入获取
    let password = localStorage.getItem('s3-master-password')
    if (!password) {
      // 如果没有设置主密码，生成一个随机密码并保存
      // 注意：这个实现不安全，仅用于演示
      // 实际应用中应该要求用户设置主密码
      password = 's3-gui-default-master-password-please-change'
      localStorage.setItem('s3-master-password', password)
    }
    return password
  },

  // 设置主密码
  setMasterPassword(password: string): void {
    localStorage.setItem('s3-master-password', password)
  },

  // 检查是否已设置主密码
  hasMasterPassword(): boolean {
    return localStorage.getItem('s3-master-password') !== null
  },
}
