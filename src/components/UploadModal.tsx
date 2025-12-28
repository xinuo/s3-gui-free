import React, { useState, useRef, useEffect } from 'react'
import {
  Modal,
  Button,
  message,
  Progress,
  List,
  Space,
  Tag,
} from 'antd'
import { InboxOutlined, DeleteOutlined } from '@ant-design/icons'
import * as dialog from '@tauri-apps/plugin-dialog'
import { useConfigStore, useBucketStore } from '../store'
import { s3Service } from '../services/s3'

interface UploadFile {
  uid: string
  name: string
  path?: string
  size?: number
  status: 'waiting' | 'uploading' | 'done' | 'error'
  percent: number
  error?: string
}

interface UploadModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const MULTIPART_THRESHOLD = 5 * 1024 * 1024 // 5MB

export const UploadModal: React.FC<UploadModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { getActiveConfig } = useConfigStore()
  const { currentBucket, currentPrefix } = useBucketStore()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // 处理文件拖拽
  useEffect(() => {
    const dropZone = dropZoneRef.current
    if (!dropZone) return

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // 只有当离开整个 drop zone 时才设置为 false
      if (e.target === dropZone) {
        setIsDragging(false)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      // 处理拖拽的文件
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          // 在 Tauri 中，我们需要使用文件路径
          // 对于 webkitGetAsEntry 的支持有限，所以使用另一种方式
          const filePath = (file as any).path || file.name
          addFileToList(filePath, file.size)
        } catch (error) {
          console.error('Failed to handle dropped file:', error)
        }
      }
    }

    dropZone.addEventListener('dragenter', handleDragEnter)
    dropZone.addEventListener('dragleave', handleDragLeave)
    dropZone.addEventListener('dragover', handleDragOver)
    dropZone.addEventListener('drop', handleDrop)

    return () => {
      dropZone.removeEventListener('dragenter', handleDragEnter)
      dropZone.removeEventListener('dragleave', handleDragLeave)
      dropZone.removeEventListener('dragover', handleDragOver)
      dropZone.removeEventListener('drop', handleDrop)
    }
  }, [])

  const addFileToList = (path: string, size: number = 0) => {
    const fileName = path.split(/[/\\]/).pop() || path
    const newFile: UploadFile = {
      uid: Date.now().toString() + Math.random(),
      name: fileName,
      path,
      size,
      status: 'waiting',
      percent: 0,
    }
    setFileList((prev) => [...prev, newFile])
  }

  const handleSelectFiles = async () => {
    try {
      const selected = await dialog.open({
        multiple: true,
        directory: false,
      }) as string | string[] | null

      if (Array.isArray(selected)) {
        selected.forEach((path) => addFileToList(path))
      } else if (selected && typeof selected === 'string') {
        addFileToList(selected)
      }
    } catch (error) {
      console.error('Failed to select files:', error)
    }
  }

  const handleUpload = async () => {
    const config = await getActiveConfig()
    if (!config || !currentBucket) {
      message.error('请先选择连接和 Bucket')
      return
    }

    setUploading(true)

    for (const file of fileList) {
      if (file.status === 'done') continue

      setFileList((prev) =>
        prev.map((f) =>
          f.uid === file.uid ? { ...f, status: 'uploading', percent: 0 } : f
        )
      )

      try {
        const key = currentPrefix
          ? currentPrefix + file.name
          : file.name

        // 假设超过 5MB 的文件使用分片上传
        // 注意：实际应该获取真实文件大小
        const useMultipart = (file.size || 0) > MULTIPART_THRESHOLD

        // 模拟进度更新
        let progress = 0
        const progressInterval = setInterval(() => {
          progress += Math.random() * 15 + 5 // 每次增加 5-20%
          if (progress > 95) progress = 95 // 最高到 95%，等待实际完成
          setFileList((prev) =>
            prev.map((f) =>
              f.uid === file.uid ? { ...f, percent: Math.min(progress, 95) } : f
            )
          )
        }, 300)

        if (useMultipart) {
          // 分片上传
          message.info(`开始分片上传: ${file.name}`)
          await s3Service.uploadMultipart(
            config,
            currentBucket,
            key,
            file.path!,
            5 // 5MB per part
          )
        } else {
          // 普通上传
          await s3Service.uploadFile(config, currentBucket, key, file.path!)
        }

        clearInterval(progressInterval)

        setFileList((prev) =>
          prev.map((f) =>
            f.uid === file.uid ? { ...f, status: 'done', percent: 100 } : f
          )
        )
      } catch (error: any) {
        setFileList((prev) =>
          prev.map((f) =>
            f.uid === file.uid
              ? { ...f, status: 'error', error: String(error) }
              : f
          )
        )
      }
    }

    setUploading(false)
    message.success('文件上传完成')
    onSuccess()
  }

  const handleRemoveFile = (uid: string) => {
    setFileList(fileList.filter((f) => f.uid !== uid))
  }

  const handleClose = () => {
    setFileList([])
    onClose()
  }

  const getStatusTag = (status: UploadFile['status'], size?: number) => {
    switch (status) {
      case 'waiting':
        return (
          <Space>
            <Tag>等待中</Tag>
            {size && size > MULTIPART_THRESHOLD && (
              <Tag color="orange">大文件</Tag>
            )}
          </Space>
        )
      case 'uploading':
        return <Tag color="blue">上传中</Tag>
      case 'done':
        return <Tag color="success">完成</Tag>
      case 'error':
        return <Tag color="error">失败</Tag>
    }
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '未知大小'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Modal
      title="上传文件"
      open={open}
      onCancel={handleClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={uploading}>
          取消
        </Button>,
        <Button
          key="select"
          onClick={handleSelectFiles}
          disabled={uploading}
        >
          选择文件
        </Button>,
        <Button
          key="upload"
          type="primary"
          onClick={handleUpload}
          disabled={fileList.length === 0 || uploading}
          loading={uploading}
        >
          开始上传
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <p>
            目标: <strong>{currentBucket}</strong>
            {currentPrefix && <span> / {currentPrefix}</span>}
          </p>
          <p style={{ color: '#999', fontSize: 12 }}>
            大于 5MB 的文件将自动使用分片上传
          </p>
        </div>

        {fileList.length > 0 && (
          <List
            dataSource={fileList}
            renderItem={(file) => (
              <List.Item
                actions={[
                  file.status !== 'uploading' && (
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveFile(file.uid)}
                    >
                      移除
                    </Button>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {file.name}
                      {getStatusTag(file.status, file.size)}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {file.size && (
                        <span style={{ fontSize: 12, color: '#666' }}>
                          大小: {formatSize(file.size)}
                        </span>
                      )}
                      {file.status === 'uploading' ? (
                        <Progress percent={file.percent} size="small" />
                      ) : file.status === 'error' ? (
                        <span style={{ color: 'red' }}>{file.error}</span>
                      ) : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}

        {fileList.length === 0 && (
          <div
            ref={dropZoneRef}
            onClick={handleSelectFiles}
            style={{
              marginTop: 16,
              padding: '40px',
              border: isDragging ? '2px dashed #40a9ff' : '2px dashed #d9d9d9',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'center',
              background: isDragging ? '#f0f8ff' : '#fafafa',
              transition: 'all 0.3s',
            }}
          >
            <p style={{ fontSize: '48px', color: isDragging ? '#40a9ff' : '#d9d9d9', marginBottom: '16px' }}>
              <InboxOutlined />
            </p>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
              {isDragging ? '释放鼠标添加文件' : '点击或拖拽文件到此区域上传'}
            </p>
            <p style={{ fontSize: '14px', color: '#999' }}>
              支持单个或批量上传，大文件自动分片
            </p>
          </div>
        )}
      </Space>
    </Modal>
  )
}
