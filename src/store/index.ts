import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { S3Config } from '../types'
import { securityService } from '../services/security'

// 加密存储适配器
const createEncryptedStorage = () => {
  return createJSONStorage(() => localStorage)
}

interface ConfigStore {
  configs: S3Config[]
  activeConfigId: string | null
  addConfig: (config: S3Config) => void
  updateConfig: (config: S3Config) => void
  deleteConfig: (id: string) => void
  getActiveConfig: () => Promise<S3Config | null>
  setActiveConfig: (id: string) => void
  // 加密相关方法
  encryptSensitiveFields: (config: S3Config) => Promise<S3Config>
  decryptSensitiveFields: (config: S3Config) => Promise<S3Config>
}

// 加密配置的敏感字段
async function encryptConfig(config: S3Config): Promise<S3Config> {
  const masterPassword = securityService.getMasterPassword()

  const encrypted = {
    ...config,
    access_key_id: await securityService.encrypt(config.access_key_id, masterPassword),
    secret_access_key: await securityService.encrypt(config.secret_access_key, masterPassword),
    _encrypted: true, // 标记为已加密
  }

  return encrypted
}

// 解密配置的敏感字段
async function decryptConfig(config: S3Config): Promise<S3Config> {
  // 如果未加密，直接返回
  if (!(config as any)._encrypted) {
    return config
  }

  const masterPassword = securityService.getMasterPassword()

  try {
    const decrypted = {
      ...config,
      access_key_id: await securityService.decrypt(config.access_key_id, masterPassword),
      secret_access_key: await securityService.decrypt(config.secret_access_key, masterPassword),
      _encrypted: undefined, // 移除加密标记
    }
    return decrypted
  } catch (error) {
    console.error('Failed to decrypt config:', error)
    // 如果解密失败，可能是主密码改变了，返回原始配置
    return config
  }
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      configs: [],
      activeConfigId: null,

      addConfig: async (config) => {
        // 加密敏感字段后再存储
        const encryptedConfig = await encryptConfig(config)
        set((state) => ({
          configs: [...state.configs, encryptedConfig],
        }))
      },

      updateConfig: async (config) => {
        // 加密敏感字段后再存储
        const encryptedConfig = await encryptConfig(config)
        set((state) => ({
          configs: state.configs.map((c) => (c.id === config.id ? encryptedConfig : c)),
        }))
      },

      deleteConfig: (id) => {
        set((state) => ({
          configs: state.configs.filter((c) => c.id !== id),
          activeConfigId: state.activeConfigId === id ? null : state.activeConfigId,
        }))
      },

      getActiveConfig: async () => {
        const { configs, activeConfigId } = get()
        const config = configs.find((c) => c.id === activeConfigId)
        if (!config) return null

        // 解密敏感字段
        return await decryptConfig(config)
      },

      setActiveConfig: (id) => {
        set({ activeConfigId: id })
      },

      encryptSensitiveFields: async (config) => {
        return await encryptConfig(config)
      },

      decryptSensitiveFields: async (config) => {
        return await decryptConfig(config)
      },
    }),
    {
      name: 's3-config-storage',
      storage: createEncryptedStorage(),
      // 在从存储恢复时，不解密数据（保持加密状态）
      // 只在需要使用时才解密
    }
  )
)

interface BucketStore {
  currentBucket: string | null
  currentPrefix: string
  setCurrentBucket: (bucket: string | null) => void
  setCurrentPrefix: (prefix: string) => void
}

export const useBucketStore = create<BucketStore>((set) => ({
  currentBucket: null,
  currentPrefix: '',

  setCurrentBucket: (bucket) => set({ currentBucket: bucket }),
  setCurrentPrefix: (prefix) => set({ currentPrefix: prefix }),
}))
