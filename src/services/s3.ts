import { invoke } from '@tauri-apps/api/core'
import type {
  S3Config,
  BucketInfo,
  ObjectMetadata,
  ListObjectsResult,
} from '../types'
import { cacheService, generateCacheKey } from './cache'

// 缓存配置
const CACHE_TTL = {
  LIST_OBJECTS: 2 * 60 * 1000, // 2 分钟
  LIST_BUCKETS: 5 * 60 * 1000, // 5 分钟
}

// Bucket 操作
export const s3Service = {
  // 列出所有 Buckets
  async listBuckets(config: S3Config, useCache = true): Promise<BucketInfo[]> {
    const cacheKey = generateCacheKey.listBuckets(config.id)

    // 尝试从缓存获取
    if (useCache) {
      const cached = cacheService.get<BucketInfo[]>(cacheKey)
      if (cached) {
        console.log('使用缓存的 bucket 列表')
        return cached
      }
    }

    // 从服务器获取
    const result = await invoke<BucketInfo[]>('list_buckets', { config })

    // 存入缓存
    cacheService.set(cacheKey, result, CACHE_TTL.LIST_BUCKETS)

    return result
  },

  // 创建 Bucket
  async createBucket(config: S3Config, bucketName: string, region?: string): Promise<void> {
    await invoke<void>('create_bucket', { config, bucketName, region })

    // 清除 bucket 列表缓存
    cacheService.delete(generateCacheKey.listBuckets(config.id))
  },

  // 删除 Bucket
  async deleteBucket(config: S3Config, bucketName: string): Promise<void> {
    await invoke<void>('delete_bucket', { config, bucketName })

    // 清除 bucket 列表缓存和该 bucket 的所有缓存
    cacheService.delete(generateCacheKey.listBuckets(config.id))
    cacheService.clearBucket(bucketName)
  },

  // 检查 Bucket 是否存在
  async headBucket(config: S3Config, bucketName: string): Promise<boolean> {
    return await invoke<boolean>('head_bucket', { config, bucketName })
  },

  // 列出 Objects
  async listObjects(
    config: S3Config,
    bucket: string,
    prefix?: string,
    delimiter?: string,
    continuationToken?: string,
    maxKeys?: number,
    useCache = true
  ): Promise<ListObjectsResult> {
    const cacheKey = generateCacheKey.listObjects(bucket, prefix)

    // 如果有 continuation token 或者不使用缓存，直接从服务器获取
    if (continuationToken || !useCache) {
      return await invoke<ListObjectsResult>('list_objects', {
        config,
        bucket,
        prefix,
        delimiter,
        continuationToken,
        maxKeys,
      })
    }

    // 尝试从缓存获取
    const cached = cacheService.get<ListObjectsResult>(cacheKey)
    if (cached) {
      console.log(`使用缓存的对象列表: ${bucket}${prefix ? `/${prefix}` : ''}`)
      return cached
    }

    // 从服务器获取
    const result = await invoke<ListObjectsResult>('list_objects', {
      config,
      bucket,
      prefix,
      delimiter,
      continuationToken,
      maxKeys,
    })

    // 存入缓存
    cacheService.set(cacheKey, result, CACHE_TTL.LIST_OBJECTS)

    return result
  },

  // 删除 Object
  async deleteObject(config: S3Config, bucket: string, key: string): Promise<void> {
    await invoke<void>('delete_object', { config, bucket, key })

    // 清除相关缓存
    this._clearListCacheForPrefix(bucket, key)
  },

  // 批量删除 Objects
  async deleteObjects(config: S3Config, bucket: string, keys: string[]): Promise<string[]> {
    const result = await invoke<string[]>('delete_objects', { config, bucket, keys })

    // 清除相关缓存
    keys.forEach(key => this._clearListCacheForPrefix(bucket, key))

    return result
  },

  // 复制 Object
  async copyObject(
    config: S3Config,
    bucket: string,
    sourceKey: string,
    destKey: string
  ): Promise<void> {
    await invoke<void>('copy_object', { config, bucket, sourceKey, destKey })

    // 清除相关缓存
    this._clearListCacheForPrefix(bucket, sourceKey)
    this._clearListCacheForPrefix(bucket, destKey)
  },

  // 移动 Object
  async moveObject(
    config: S3Config,
    bucket: string,
    sourceKey: string,
    destKey: string
  ): Promise<void> {
    await invoke<void>('move_object', { config, bucket, sourceKey, destKey })

    // 清除相关缓存
    this._clearListCacheForPrefix(bucket, sourceKey)
    this._clearListCacheForPrefix(bucket, destKey)
  },

  // 重命名 Object
  async renameObject(
    config: S3Config,
    bucket: string,
    oldKey: string,
    newKey: string
  ): Promise<void> {
    await invoke<void>('rename_object', { config, bucket, oldKey, newKey })

    // 清除相关缓存
    this._clearListCacheForPrefix(bucket, oldKey)
    this._clearListCacheForPrefix(bucket, newKey)
  },

  // 获取 Object 元数据
  async headObject(
    config: S3Config,
    bucket: string,
    key: string
  ): Promise<ObjectMetadata> {
    return await invoke<ObjectMetadata>('head_object', { config, bucket, key })
  },

  // 上传单个文件
  async uploadFile(
    config: S3Config,
    bucket: string,
    key: string,
    filePath: string,
    contentType?: string
  ): Promise<string> {
    const result = await invoke<string>('upload_file', {
      config,
      bucket,
      key,
      filePath,
      contentType,
    })

    // 清除相关缓存
    this._clearListCacheForPrefix(bucket, key)

    return result
  },

  // 上传多个文件
  async uploadFiles(
    config: S3Config,
    bucket: string,
    files: Array<[string, string]>
  ): Promise<string[]> {
    const result = await invoke<string[]>('upload_files', { config, bucket, files })

    // 清除相关缓存
    files.forEach(([key]) => this._clearListCacheForPrefix(bucket, key))

    return result
  },

  // 分片上传（大文件）
  async uploadMultipart(
    config: S3Config,
    bucket: string,
    key: string,
    filePath: string,
    partSizeMb?: number
  ): Promise<string> {
    const result = await invoke<string>('upload_multipart', {
      config,
      bucket,
      key,
      filePath,
      partSizeMb,
    })

    // 清除相关缓存
    this._clearListCacheForPrefix(bucket, key)

    return result
  },

  // 取消分片上传
  async abortMultipartUpload(
    config: S3Config,
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<void> {
    return await invoke<void>('abort_multipart_upload', {
      config,
      bucket,
      key,
      uploadId,
    })
  },

  // 下载单个文件
  async downloadFile(
    config: S3Config,
    bucket: string,
    key: string,
    savePath: string
  ): Promise<string> {
    return await invoke<string>('download_file', {
      config,
      bucket,
      key,
      savePath,
    })
  },

  // 下载多个文件
  async downloadFiles(
    config: S3Config,
    bucket: string,
    files: Array<[string, string]>
  ): Promise<string[]> {
    return await invoke<string[]>('download_files', { config, bucket, files })
  },

  // 获取文件内容到内存（用于预览）
  async getFileContent(
    config: S3Config,
    bucket: string,
    key: string
  ): Promise<string> {
    return await invoke<string>('get_file_content', { config, bucket, key })
  },

  // 获取文件的二进制数据（Base64 编码，用于图片预览）
  async getFileBytes(
    config: S3Config,
    bucket: string,
    key: string
  ): Promise<string> {
    return await invoke<string>('get_file_bytes', { config, bucket, key })
  },

  // 辅助方法：清除特定前缀的缓存
  _clearListCacheForPrefix(bucket: string, key: string): void {
    // 获取 key 的前缀（目录）
    const prefix = key.substring(0, key.lastIndexOf('/') + 1)

    // 清除该 bucket 的根列表缓存
    cacheService.delete(generateCacheKey.listObjects(bucket, ''))

    // 如果有前缀，也清除前缀的缓存
    if (prefix) {
      cacheService.delete(generateCacheKey.listObjects(bucket, prefix))
    }
  },
}
