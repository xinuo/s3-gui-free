import React, { useState, useEffect } from 'react'
import { Modal, Spin, Button, message, Image } from 'antd'
import {
  FileImageOutlined,
  FileTextOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import heic2any from 'heic2any'
import { useConfigStore, useBucketStore } from '../store'
import { s3Service } from '../services/s3'
import type { ObjectMetadata } from '../types'

interface FilePreviewProps {
  open: boolean
  file: ObjectMetadata | null
  onClose: () => void
}

// 文件大小限制：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// 根据文件扩展名获取 MIME 类型
const getMimeTypeFromExt = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase()

  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'svg': 'image/svg+xml',
    'heic': 'image/heic',
    'heif': 'image/heif',
  }

  return mimeMap[ext || ''] || 'image/jpeg'
}

// 根据文件扩展名获取 Monaco 语言模式
const getLanguageFromExt = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase()

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'mjs': 'javascript',
    'cjs': 'javascript',

    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'sass': 'sass',
    'json': 'json',
    'xml': 'xml',

    // Python
    'py': 'python',
    'pyw': 'python',

    // Java
    'java': 'java',

    // C/C++/C#
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',

    // Rust
    'rs': 'rust',

    // Go
    'go': 'go',

    // Other
    'md': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'conf': 'ini',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'sql': 'sql',
    'php': 'php',
    'rb': 'ruby',
    'kt': 'kotlin',
    'swift': 'swift',
    'dart': 'dart',
    'lua': 'lua',
    'r': 'r',
    'scala': 'scala',
    'vue': 'vue',
    'svelte': 'svelte',
  }

  return languageMap[ext || ''] || 'plaintext'
}

// 判断是否为文本文件
const isTextFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const textExtensions = [
    'txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx',
    'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb',
    'yaml', 'yml', 'toml', 'ini', 'conf', 'sh', 'bash', 'sql', 'vue', 'svelte',
    'scss', 'less', 'log', 'csv', 'mjs', 'cjs', 'kt', 'swift', 'dart',
    'lua', 'r', 'scala', 'fish', 'zsh'
  ]
  return textExtensions.includes(ext || '')
}

// 判断是否为图片文件
const isImageFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif'].includes(ext || '')
}

// 判断是否为 HEIC/HEIF 格式
const isHeicFormat = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ['heic', 'heif'].includes(ext || '')
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  open,
  file,
  onClose,
}) => {
  const { getActiveConfig } = useConfigStore()
  const { currentBucket } = useBucketStore()
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<string>('')
  const [language, setLanguage] = useState<string>('plaintext')
  const [fileType, setFileType] = useState<'text' | 'image' | 'unknown'>('unknown')
  const [imageUrl, setImageUrl] = useState<string>('')

  useEffect(() => {
    if (open && file) {
      loadFileContent()
    } else {
      // 清理状态
      setContent('')
      setLanguage('plaintext')
      setFileType('unknown')
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
        setImageUrl('')
      }
    }
  }, [open, file])

  const loadFileContent = async () => {
    if (!file || !currentBucket) return

    const config = await getActiveConfig()
    if (!config) return

    // 检查文件大小
    if (file.size && file.size > MAX_FILE_SIZE) {
      message.warning(`文件大小超过 10MB，无法预览。当前大小：${(file.size / 1024 / 1024).toFixed(2)} MB`)
      return
    }

    const fileName = file.key.split('/').pop() || file.key

    // 判断文件类型
    if (isImageFile(fileName)) {
      setFileType('image')
      setLoading(true)
      try {
        // 获取图片的 base64 数据
        const base64Data = await s3Service.getFileBytes(config, currentBucket, file.key)
        const mimeType = getMimeTypeFromExt(fileName)

        // 如果是 HEIC/HEIF 格式，需要转换
        if (isHeicFormat(fileName)) {
          try {
            // 将 base64 转换为 Blob
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const blob = new Blob([bytes], { type: mimeType })

            // 转换为 JPEG/PNG
            const convertedBlob = await heic2any({
              blob,
              toType: 'image/jpeg',
              quality: 0.9,
            })

            // 创建预览 URL
            const url = URL.createObjectURL(convertedBlob as Blob)
            setImageUrl(url)
          } catch (heicError) {
            console.error('HEIC 转换失败:', heicError)
            message.error('HEIC 格式转换失败，请下载后查看')
          }
        } else {
          // 其他图片格式直接使用 base64
          const url = `data:${mimeType};base64,${base64Data}`
          setImageUrl(url)
        }
      } catch (error: any) {
        message.error(`加载图片失败: ${error}`)
        setImageUrl('')
      } finally {
        setLoading(false)
      }
      return
    }

    if (isTextFile(fileName)) {
      setFileType('text')
      setLanguage(getLanguageFromExt(fileName))

      setLoading(true)
      try {
        const fileContent = await s3Service.getFileContent(config, currentBucket, file.key)
        setContent(fileContent)
      } catch (error: any) {
        message.error(`加载文件内容失败: ${error}`)
        setContent('')
      } finally {
        setLoading(false)
      }
    } else {
      setFileType('unknown')
    }
  }

  const handleDownload = async () => {
    if (!file || !currentBucket) return

    const config = await getActiveConfig()
    if (!config) return

    try {
      const fileName = file.key.split('/').pop() || file.key
      const { save } = await import('@tauri-apps/plugin-dialog')

      const savePath = await save({
        defaultPath: fileName,
      })

      if (savePath) {
        await s3Service.downloadFile(config, currentBucket, file.key, savePath)
        message.success('下载成功')
      }
    } catch (error: any) {
      message.error(`下载失败: ${error}`)
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#666' }}>
            {fileType === 'image' ? '正在加载图片...' : '正在加载文件内容...'}
          </p>
        </div>
      )
    }

    if (!file) {
      return <div style={{ textAlign: 'center', padding: 40 }}>未选择文件</div>
    }

    const fileName = file.key.split('/').pop() || file.key
    const fileSize = file.size ? `${(file.size / 1024).toFixed(2)} KB` : '未知大小'

    // 文件大小超过限制
    if (file.size && file.size > MAX_FILE_SIZE) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
          <h3 style={{ marginTop: 16 }}>{fileName}</h3>
          <p style={{ color: '#666', marginBottom: 16 }}>文件大小: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
          <p style={{ color: '#ff4d4f', marginBottom: 24 }}>
            文件大小超过 10MB，无法预览。请下载后查看。
          </p>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            下载文件
          </Button>
        </div>
      )
    }

    // 图片文件预览
    if (fileType === 'image') {
      if (!imageUrl) {
        return (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <FileImageOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <h3 style={{ marginTop: 16 }}>{fileName}</h3>
            <p style={{ color: '#666', marginBottom: 16 }}>文件大小: {fileSize}</p>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
              下载文件
            </Button>
          </div>
        )
      }

      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: 14 }}>
              {fileName} ({fileSize})
            </span>
            <Button icon={<DownloadOutlined />} onClick={handleDownload}>
              下载
            </Button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <Image
              src={imageUrl}
              alt={fileName}
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 300px)', objectFit: 'contain' }}
              preview={{
                mask: '点击查看大图',
              }}
            />
          </div>
        </div>
      )
    }

    // 不支持的文件类型
    if (fileType === 'unknown') {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#666' }} />
          <h3 style={{ marginTop: 16 }}>{fileName}</h3>
          <p style={{ color: '#666', marginBottom: 16 }}>文件大小: {fileSize}</p>
          <p style={{ color: '#666', marginBottom: 24 }}>
            此文件类型不支持预览。
          </p>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            下载文件
          </Button>
        </div>
      )
    }

    // 文本文件预览
    return (
      <div style={{ height: 'calc(100vh - 200px)', minHeight: 400 }}>
        <div
          style={{
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#666' }}>
            {fileName} ({fileSize})
          </span>
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>
            下载
          </Button>
        </div>
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
          }}
        />
      </div>
    )
  }

  return (
    <Modal
      title="文件预览"
      open={open}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20 }}
      bodyStyle={{ padding: fileType === 'text' ? '16px' : '24px' }}
      destroyOnClose
    >
      {renderContent()}
    </Modal>
  )
}
