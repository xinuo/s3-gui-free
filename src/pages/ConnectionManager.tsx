import React, { useState } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Table,
  Space,
  Popconfirm,
  message,
  Card,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons'
import { useConfigStore } from '../store'
import { v4 as uuidv4 } from 'uuid'

const { Option } = Select

export const ConnectionManager: React.FC = () => {
  const { configs, addConfig, updateConfig, deleteConfig, setActiveConfig } = useConfigStore()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [form] = Form.useForm()

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const config = {
        id: editingConfig || uuidv4(),
        ...values,
      }

      if (editingConfig) {
        updateConfig(config)
        message.success('配置更新成功')
      } else {
        addConfig(config)
        message.success('配置添加成功')
      }

      setIsModalVisible(false)
      setEditingConfig(null)
      form.resetFields()
    } catch (error) {
      console.error('Form validation failed:', error)
    }
  }

  const handleEdit = (config: any) => {
    setEditingConfig(config.id)
    form.setFieldsValue(config)
    setIsModalVisible(true)
  }

  const handleDelete = (id: string) => {
    deleteConfig(id)
    message.success('配置删除成功')
  }

  const handleActive = (id: string) => {
    setActiveConfig(id)
    message.success('已设置为当前连接')
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Access Key ID',
      dataIndex: 'access_key_id',
      key: 'access_key_id',
      render: (key: string) => `${key.substring(0, 8)}...`,
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      render: (region: string) => region || 'us-east-1',
    },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      key: 'endpoint',
      render: (endpoint: string) => endpoint || 'AWS S3',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<CheckOutlined />}
            onClick={() => handleActive(record.id)}
          >
            使用
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个配置吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card title="连接管理">
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setEditingConfig(null)
          form.resetFields()
          setIsModalVisible(true)
        }}
        style={{ marginBottom: 16 }}
      >
        添加连接
      </Button>

      <Table dataSource={configs} rowKey="id" columns={columns} />

      <Modal
        title={editingConfig ? '编辑连接' : '添加连接'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalVisible(false)
          setEditingConfig(null)
          form.resetFields()
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="连接名称"
            name="name"
            rules={[{ required: true, message: '请输入连接名称' }]}
          >
            <Input placeholder="例如: AWS S3" />
          </Form.Item>

          <Form.Item
            label="Access Key ID"
            name="access_key_id"
            rules={[{ required: true, message: '请输入 Access Key ID' }]}
          >
            <Input placeholder="AKIAIOSFODNN7EXAMPLE" />
          </Form.Item>

          <Form.Item
            label="Secret Access Key"
            name="secret_access_key"
            rules={[{ required: true, message: '请输入 Secret Access Key' }]}
          >
            <Input.Password placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" />
          </Form.Item>

          <Form.Item label="Region" name="region">
            <Select placeholder="选择或输入 Region" allowClear>
              <Option value="us-east-1">us-east-1 (US East (N. Virginia))</Option>
              <Option value="us-west-1">us-west-1 (US West (N. California))</Option>
              <Option value="us-west-2">us-west-2 (US West (Oregon))</Option>
              <Option value="eu-west-1">eu-west-1 (Europe (Ireland))</Option>
              <Option value="eu-central-1">eu-central-1 (Europe (Frankfurt))</Option>
              <Option value="ap-southeast-1">ap-southeast-1 (Asia Pacific (Singapore))</Option>
              <Option value="ap-northeast-1">ap-northeast-1 (Asia Pacific (Tokyo))</Option>
              <Option value="ap-east-1">ap-east-1 (Asia Pacific (Hong Kong))</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Endpoint (可选)" name="endpoint">
            <Input placeholder="https://s3.amazonaws.com 或自定义 endpoint" />
          </Form.Item>

          <Form.Item label="Session Token (可选)" name="session_token">
            <Input.TextArea placeholder="Session Token" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
