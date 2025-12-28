import React, { useEffect, useState } from 'react'
import {
  Table,
  Space,
  Button,
  Breadcrumb,
  message,
  Modal,
  Input,
  Typography,
  Popconfirm,
} from 'antd'
import {
  FolderOutlined,
  FileOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  EditOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import * as dialog from '@tauri-apps/plugin-dialog'
import { useConfigStore, useBucketStore } from '../store'
import { s3Service } from '../services/s3'
import { UploadModal } from '../components/UploadModal'
import { FilePreview } from '../components/FilePreview'
import type { ObjectMetadata } from '../types'
import dayjs from 'dayjs'

const { Search } = Input
const { Text } = Typography

export const FileBrowser: React.FC = () => {
  const { getActiveConfig } = useConfigStore()
  const { currentBucket, currentPrefix, setCurrentPrefix } = useBucketStore()
  const [objects, setObjects] = useState<ObjectMetadata[]>([])
  const [filteredObjects, setFilteredObjects] = useState<ObjectMetadata[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')

  // 预览
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<ObjectMetadata | null>(null)

  // 重命名
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameKey, setRenameKey] = useState('')
  const [newName, setNewName] = useState('')

  // 正在处理的操作 key => 操作类型
  const [processingKeys, setProcessingKeys] = useState<Record<string, 'delete' | 'rename' | 'download'>>({})

  const fetchObjects = async () => {
    const config = await getActiveConfig()
    if (!config) {
      message.warning('请先选择一个连接配置')
      return
    }

    if (!currentBucket) {
      message.warning('请先选择一个 Bucket')
      return
    }

    setLoading(true)
    try {
      const result = await s3Service.listObjects(
        config,
        currentBucket,
        currentPrefix || undefined,
        '/',
        undefined,
        1000
      )

      const filteredObjects = result.objects.filter(
        (obj) => obj.key !== currentPrefix?.replace(/\/$/, '')
      )

      setObjects(filteredObjects)
      setFilteredObjects(filteredObjects)
      setFolders(result.common_prefixes)
    } catch (error: any) {
      message.error(`获取对象列表失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentBucket) {
      fetchObjects()
    }
  }, [currentBucket, currentPrefix])

  // 搜索过滤
  useEffect(() => {
    if (!searchText) {
      setFilteredObjects(objects)
    } else {
      const filtered = objects.filter((obj) => {
        const name = obj.key.split('/').pop() || obj.key
        return name.toLowerCase().includes(searchText.toLowerCase())
      })
      setFilteredObjects(filtered)
    }
  }, [searchText, objects])

  // 当切换文件夹时，清除选中状态
  useEffect(() => {
    setSelectedKeys([])
  }, [currentPrefix])

  const handleDelete = async (key: string) => {
    const config = await getActiveConfig()
    if (!config || !currentBucket) return

    setProcessingKeys(prev => ({ ...prev, [key]: 'delete' }))
    try {
      await s3Service.deleteObject(config, currentBucket, key)
      message.success('删除成功')

      // 从选中项中移除已删除的文件
      setSelectedKeys(prev => prev.filter(k => k !== key))

      fetchObjects()
    } catch (error: any) {
      message.error(`删除失败: ${error}`)
    } finally {
      setProcessingKeys(prev => {
        const newKeys = { ...prev }
        delete newKeys[key]
        return newKeys
      })
    }
  }

  const handleRename = async () => {
    if (!newName.trim()) {
      message.warning('请输入新名称')
      return
    }

    const config = await getActiveConfig()
    if (!config || !currentBucket || !renameKey) return

    const newKey = currentPrefix
      ? currentPrefix + newName
      : newName

    // 关闭弹窗并开始重命名
    setRenameModalOpen(false)
    setProcessingKeys(prev => ({ ...prev, [renameKey]: 'rename' }))

    const hide = message.loading(`正在重命名 "${renameKey.split('/').pop()}" 为 "${newName}"...`, 0)

    try {
      await s3Service.renameObject(config, currentBucket, renameKey, newKey)
      hide()
      message.success('重命名成功')
      setNewName('')
      fetchObjects()
    } catch (error: any) {
      hide()
      message.error(`重命名失败: ${error}`)
    } finally {
      setProcessingKeys(prev => {
        const newKeys = { ...prev }
        delete newKeys[renameKey]
        return newKeys
      })
    }
  }

  const handleDownload = async (key: string) => {
    const config = await getActiveConfig()
    if (!config || !currentBucket) return

    try {
      const fileName = key.split('/').pop() || key

      const savePath = await dialog.save({
        defaultPath: fileName,
        filters: [
          {
            name: fileName,
            extensions: [fileName.split('.').pop() || '*'],
          },
        ],
      })

      if (savePath) {
        setProcessingKeys(prev => ({ ...prev, [key]: 'download' }))

        // 显示加载提示，duration 为 0 表示不自动关闭
        const hide = message.loading(`正在下载 ${fileName}...`, 0)

        try {
          await s3Service.downloadFile(config, currentBucket, key, savePath)
          // 关闭加载提示
          hide()
          message.success(`${fileName} 下载成功`)
        } catch (err) {
          // 关闭加载提示
          hide()
          message.error(`下载失败: ${err}`)
          throw err
        } finally {
          setProcessingKeys(prev => {
            const newKeys = { ...prev }
            delete newKeys[key]
            return newKeys
          })
        }
      }
    } catch (error: any) {
      message.error(`下载失败: ${error}`)
    }
  }

  const handleBatchDownload = async () => {
    const config = await getActiveConfig()
    if (!config || !currentBucket || selectedKeys.length === 0) return

    try {
      const dirPath = await dialog.open({
        directory: true,
      })

      if (dirPath && typeof dirPath === 'string') {
        message.loading(`正在下载 ${selectedKeys.length} 个文件...`, 0)

        const files = selectedKeys.map((key) => {
          const fileName = key.split('/').pop() || key
          return [key, `${dirPath}/${fileName}`] as [string, string]
        })

        await s3Service.downloadFiles(config, currentBucket, files)
        message.destroy()
        message.success('批量下载完成')
        setSelectedKeys([])
      }
    } catch (error: any) {
      message.destroy()
      message.error(`批量下载失败: ${error}`)
    }
  }

  const handlePreview = (record: ObjectMetadata) => {
    setPreviewFile(record)
    setPreviewOpen(true)
  }

  // 文件大小限制：10MB
  const canPreviewFile = (record: any) => {
    if (record.is_folder) return false
    if (!record.size) return true // 如果没有大小信息，允许预览
    return record.size <= 10 * 1024 * 1024 // 只允许小于等于 10MB 的文件预览
  }

  const isImageFile = (key: string) => {
    const ext = key.split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif'].includes(ext || '')
  }

  const isTextFile = (key: string) => {
    const ext = key.split('.').pop()?.toLowerCase()
    return ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs'].includes(ext || '')
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const parsePrefix = (prefix: string) => {
    const parts = prefix.split('/').filter((p) => p)
    return parts.map((part, index) => ({
      name: part,
      path: parts.slice(0, index + 1).join('/') + '/',
    }))
  }

  const breadcrumbItems = parsePrefix(currentPrefix)

  const columns = [
    {
      title: '名称',
      dataIndex: 'key',
      key: 'key',
      render: (key: string, record: any) => {
        const name = key.split('/').filter(Boolean).pop() || key
        if (record.is_folder) {
          return (
            <Space>
              <FolderOutlined style={{ color: '#1890ff' }} />
              <Text strong>{name}</Text>
            </Space>
          )
        }
        return (
          <Space>
            <FileOutlined />
            <Text ellipsis={{ tooltip: key }} style={{ maxWidth: 300 }}>
              {name}
            </Text>
          </Space>
        )
      },
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number, record: any) => {
        if (record.is_folder) return '-'
        return formatSize(size)
      },
      sorter: (a: any, b: any) => {
        if (a.is_folder) return -1
        if (b.is_folder) return 1
        return a.size - b.size
      },
    },
    {
      title: '最后修改',
      dataIndex: 'last_modified',
      key: 'last_modified',
      render: (date: string, record: any) => {
        if (record.is_folder) return '-'
        return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
      },
      sorter: (a: any, b: any) => {
        if (a.is_folder) return -1
        if (b.is_folder) return 1
        return dayjs(a.last_modified).unix() - dayjs(b.last_modified).unix()
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => {
        if (record.is_folder) return null
        const isProcessing = processingKeys[record.key]
        return (
          <Space size="small">
            {(isImageFile(record.key) || isTextFile(record.key)) && (
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handlePreview(record)}
                disabled={!!isProcessing || !canPreviewFile(record)}
                title={!canPreviewFile(record) ? '文件大小超过 10MB，无法预览' : undefined}
              >
                预览
              </Button>
            )}
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setRenameKey(record.key)
                setNewName(record.key.split('/').pop() || record.key)
                setRenameModalOpen(true)
              }}
              disabled={!!isProcessing}
              loading={isProcessing === 'rename'}
            >
              重命名
            </Button>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record.key)}
              disabled={!!isProcessing}
              loading={isProcessing === 'download'}
            >
              下载
            </Button>
            <Popconfirm
              title="确认删除"
              description={`确定要删除 "${record.key.split('/').pop() || record.key}" 吗？此操作不可恢复！`}
              onConfirm={() => handleDelete(record.key)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={!!isProcessing}
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!!isProcessing}
                loading={isProcessing === 'delete'}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      {/* 搜索和操作栏 */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Search
            placeholder="搜索文件名"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchObjects}
            loading={loading}
          >
            刷新
          </Button>
          {selectedKeys.length > 0 && (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleBatchDownload}
            >
              下载选中 ({selectedKeys.length})
            </Button>
          )}
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setUploadModalOpen(true)}
          >
            上传文件
          </Button>
        </Space>
      </div>

      {/* 面包屑导航 */}
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb
          items={[
            { title: <a onClick={() => setCurrentPrefix('')}>{currentBucket}</a> },
            ...breadcrumbItems.map((item) => ({
              title: <a onClick={() => setCurrentPrefix(item.path)}>{item.name}</a>,
            })),
          ]}
        />
      </div>

      {/* 文件列表 */}
      <Table
        dataSource={[
          ...folders.map((f) => ({
            key: f,
            name: f.split('/').filter(Boolean).pop() || f,
            size: 0,
            last_modified: '',
            storage_class: 'FOLDER',
            is_folder: true,
          })),
          ...filteredObjects,
        ]}
        columns={columns}
        rowKey="key"
        loading={loading}
        pagination={{ pageSize: 50 }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys as string[]),
          getCheckboxProps: (record: any) => ({
            disabled: record.is_folder,
          }),
        }}
        onRow={(record) => ({
          onClick: () => record.is_folder && setCurrentPrefix(record.key),
          style: record.is_folder ? { cursor: 'pointer' } : undefined,
        })}
      />

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchObjects()
          setUploadModalOpen(false)
        }}
      />

      <FilePreview
        open={previewOpen}
        file={previewFile}
        onClose={() => {
          setPreviewOpen(false)
          setPreviewFile(null)
        }}
      />

      <Modal
        title="重命名"
        open={renameModalOpen}
        onOk={handleRename}
        onCancel={() => {
          setRenameModalOpen(false)
          setNewName('')
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="输入新名称"
          onPressEnter={handleRename}
        />
      </Modal>
    </div>
  )
}
