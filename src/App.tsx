import React, { useState, useEffect } from 'react'
import { Layout, Menu, theme, message } from 'antd'
import {
  CloudServerOutlined,
  FolderOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { ConnectionManager } from './pages/ConnectionManager'
import { BucketList } from './pages/BucketList'
import { FileBrowser } from './pages/FileBrowser'
import { useConfigStore, useBucketStore } from './store'
import { s3Service } from './services/s3'
import './App.css'

const { Header, Content, Sider } = Layout

type MenuItem = {
  key: string
  icon: React.ReactNode
  label: string
}

const items: MenuItem[] = [
  {
    key: 'connections',
    icon: <SettingOutlined />,
    label: '连接管理',
  },
  {
    key: 'buckets',
    icon: <CloudServerOutlined />,
    label: 'Bucket 列表',
  },
  {
    key: 'files',
    icon: <FolderOutlined />,
    label: '文件浏览器',
  },
]

const App: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState('connections')
  const { currentBucket, setCurrentBucket } = useBucketStore()
  const { getActiveConfig } = useConfigStore()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // 应用启动时自动加载 bucket 列表
  useEffect(() => {
    const autoLoadBucket = async () => {
      const config = await getActiveConfig()
      if (!config) return

      // 如果已经有选中的 bucket，不重复加载
      if (currentBucket) return

      try {
        const buckets = await s3Service.listBuckets(config)

        // 如果只有一个 bucket，自动选中
        if (buckets.length === 1) {
          setCurrentBucket(buckets[0].name)
          message.success(`已自动加载 Bucket: ${buckets[0].name}`)
        }
      } catch (error) {
        // 静默失败，不影响用户体验
        console.error('Failed to auto-load buckets:', error)
      }
    }

    autoLoadBucket()
  }, [])

  const renderContent = () => {
    switch (selectedKey) {
      case 'connections':
        return <ConnectionManager />
      case 'buckets':
        return <BucketList />
      case 'files':
        return currentBucket ? <FileBrowser /> : <div>请先选择一个 Bucket</div>
      default:
        return <ConnectionManager />
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          background: colorBgContainer,
        }}
      >
        <div style={{ height: 32, margin: 16, fontSize: 20, fontWeight: 'bold' }}>
          S3 GUI
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={items}
          onClick={({ key }) => setSelectedKey(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ padding: '0 24px', fontSize: 18, fontWeight: 'bold' }}>
            {items.find((i) => i.key === selectedKey)?.label}
          </div>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {renderContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
