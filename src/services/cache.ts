interface CacheEntry<T> {
  data: T
  timestamp: number
  key: string
}

interface ListObjectsCacheKey {
  bucket: string
  prefix?: string
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 5 * 60 * 1000 // 5 分钟默认缓存时间

  // 生成缓存键
  private generateKey(parts: (string | undefined)[]): string {
    return parts.filter(Boolean).join(':')
  }

  // 设置缓存
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      key,
    }
    this.cache.set(key, entry)

    // 如果设置了 TTL，自动过期
    const expiration = ttl || this.defaultTTL
    setTimeout(() => {
      this.cache.delete(key)
    }, expiration)
  }

  // 获取缓存
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    return entry.data as T
  }

  // 检查缓存是否存在且有效
  has(key: string): boolean {
    return this.cache.has(key)
  }

  // 清除特定缓存
  delete(key: string): void {
    this.cache.delete(key)
  }

  // 清除所有缓存
  clear(): void {
    this.cache.clear()
  }

  // 清除特定 bucket 的所有缓存
  clearBucket(bucket: string): void {
    for (const [key] of this.cache) {
      if (key.startsWith(bucket)) {
        this.cache.delete(key)
      }
    }
  }

  // 为对象列表生成缓存键
  generateListObjectsKey(params: ListObjectsCacheKey): string {
    return this.generateKey(['list-objects', params.bucket, params.prefix])
  }
}

// 导出单例实例
export const cacheService = new CacheService()

// 缓存键生成器辅助函数
export const generateCacheKey = {
  listObjects: (bucket: string, prefix?: string) =>
    `list-objects:${bucket}${prefix ? `:${prefix}` : ''}`,

  listBuckets: (configId: string) => `list-buckets:${configId}`,

  objectMetadata: (bucket: string, key: string) =>
    `object-metadata:${bucket}:${key}`,
}
