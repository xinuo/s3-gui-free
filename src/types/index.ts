// S3 配置类型
export interface S3Config {
  id: string
  name: string
  access_key_id: string
  secret_access_key: string
  region?: string
  endpoint?: string
  session_token?: string
  bucket?: string
}

// Bucket 信息
export interface BucketInfo {
  name: string
  creation_date: string
  region?: string
}

// Object 元数据
export interface ObjectMetadata {
  key: string
  last_modified: string
  size: number
  etag: string
  storage_class: string
  content_type?: string
  is_folder: boolean
}

// 列出 Objects 结果
export interface ListObjectsResult {
  objects: ObjectMetadata[]
  common_prefixes: string[]
  is_truncated: boolean
  next_continuation_token?: string
}

// 上传进度
export interface UploadProgress {
  key: string
  uploaded_bytes: number
  total_bytes: number
  percentage: number
}

// 下载进度
export interface DownloadProgress {
  key: string
  downloaded_bytes: number
  total_bytes: number
  percentage: number
}
