import React, { useEffect, useState } from 'react'
import { Table, Space, Button, message, Popconfirm, Modal, Input, Select } from 'antd'
import { PlusOutlined, DeleteOutlined, FolderOutlined, RightOutlined } from '@ant-design/icons'
import { useConfigStore, useBucketStore } from '../store'
import { s3Service } from '../services/s3'
import type { BucketInfo } from '../types'

const { Option } = Select

export const BucketList: React.FC = () => {
  const { getActiveConfig } = useConfigStore()
  const { currentBucket, setCurrentBucket } = useBucketStore()
  const [buckets, setBuckets] = useState<BucketInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [bucketName, setBucketName] = useState('')
  const [region, setRegion] = useState('us-east-1')

  const fetchBuckets = async () => {
    const config = await getActiveConfig()
    if (!config) {
      message.warning('请先选择一个连接配置')
      return
    }

    setLoading(true)
    try {
      const result = await s3Service.listBuckets(config)
      setBuckets(result)
    } catch (error: any) {
      message.error(`获取 Bucket 列表失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBuckets()
  }, [])

  const handleCreateBucket = async () => {
    const config = await getActiveConfig()
    if (!config) {
      message.warning('请先选择一个连接配置')
      return
    }

    if (!bucketName.trim()) {
      message.warning('请输入 Bucket 名称')
      return
    }

    try {
      await s3Service.createBucket(config, bucketName, region)
      message.success('Bucket 创建成功')
      setIsCreateModalVisible(false)
      setBucketName('')
      fetchBuckets()
    } catch (error: any) {
      message.error(`创建 Bucket 失败: ${error}`)
    }
  }

  const handleDeleteBucket = async (bucketName: string) => {
    const config = await getActiveConfig()
    if (!config) {
      message.warning('请先选择一个连接配置')
      return
    }

    try {
      await s3Service.deleteBucket(config, bucketName)
      message.success('Bucket 删除成功')
      if (currentBucket === bucketName) {
        setCurrentBucket(null)
      }
      fetchBuckets()
    } catch (error: any) {
      message.error(`删除 Bucket 失败: ${error}`)
    }
  }

  const handleSelectBucket = (bucketName: string) => {
    setCurrentBucket(bucketName)
    message.success(`已选择 Bucket: ${bucketName}`)
  }

  const columns = [
    {
      title: 'Bucket 名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <FolderOutlined />
          {name}
          {currentBucket === name && (
            <span style={{ color: '#52c41a' }}>(当前)</span>
          )}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'creation_date',
      key: 'creation_date',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: BucketInfo) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<RightOutlined />}
            onClick={() => handleSelectBucket(record.name)}
          >
            {currentBucket === record.name ? '已选择' : '打开'}
          </Button>
          <Popconfirm
            title="确定要删除这个 Bucket 吗？"
            description="删除 Bucket 将删除其中的所有数据，此操作不可恢复！"
            onConfirm={() => handleDeleteBucket(record.name)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Bucket 列表</h2>
        <Space>
          <Button onClick={fetchBuckets}>刷新</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalVisible(true)}
          >
            创建 Bucket
          </Button>
        </Space>
      </div>

      <Table
        dataSource={buckets}
        columns={columns}
        rowKey="name"
        loading={loading}
      />

      <Modal
        title="创建 Bucket"
        open={isCreateModalVisible}
        onOk={handleCreateBucket}
        onCancel={() => setIsCreateModalVisible(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div>Bucket 名称:</div>
            <Input
              placeholder="my-unique-bucket-name"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
            />
          </div>
          <div>
            <div>Region:</div>
            <Select
              style={{ width: '100%' }}
              value={region}
              onChange={setRegion}
            >
              <Option value="us-east-1">us-east-1</Option>
              <Option value="us-west-1">us-west-1</Option>
              <Option value="us-west-2">us-west-2</Option>
              <Option value="eu-west-1">eu-west-1</Option>
              <Option value="eu-central-1">eu-central-1</Option>
              <Option value="ap-southeast-1">ap-southeast-1</Option>
              <Option value="ap-northeast-1">ap-northeast-1</Option>
              <Option value="ap-east-1">ap-east-1</Option>
            </Select>
          </div>
        </Space>
      </Modal>
    </div>
  )
}
