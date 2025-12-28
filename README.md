# S3 GUI

一个使用 Tauri + React + TypeScript 开发的 S3 文件浏览器，支持完整的 S3 协议操作。

## 功能特性

### 连接管理
- 添加/编辑/删除 S3 连接配置
- 支持 AWS S3 和兼容 S3 协议的服务（如 MinIO、阿里云 OSS、腾讯云 COS 等）
- 本地安全存储连接信息

### Bucket 管理
- 列出所有 Buckets
- 创建 Bucket（支持选择 Region）
- 删除 Bucket
- 快速打开 Bucket 进入文件浏览器

### 文件浏览与操作
- **文件浏览**
  - 浏览 Bucket 中的文件和文件夹
  - 面包屑导航，支持快速返回上级目录
  - 文件列表展示（名称、大小、修改时间、存储类型）
  - 点击文件夹进入子目录
  - 多选文件批量操作

- **文件操作**
  - 重命名文件
  - 复制文件
  - 移动文件
  - 删除文件/对象
  - 多选批量下载
  - 多选批量删除

- **搜索与筛选**
  - 实时文件名搜索
  - 按文件大小排序
  - 按修改时间排序
  - 按存储类型筛选

### 文件上传
- 单文件上传
- 批量上传
- 拖拽上传
- **大文件分片上传**（>5MB 自动使用分片上传）
- 上传进度显示

### 文件下载
- 单文件下载（选择保存位置）
- 批量下载（选择目标目录）
- 下载进度提示

### 文件预览
- 图片文件预览（支持 jpg, png, gif, webp, svg 等）
- 文本文件预览（支持 txt, md, json, xml, 代码文件等）
- 文件信息展示

## 技术栈

### 前端
- React 19 + TypeScript
- Vite
- Ant Design 5（UI 组件库）
- Zustand（状态管理）
- Day.js（日期处理）

### 后端
- Rust
- Tauri 2
- AWS SDK for Rust（S3 客户端）
- Tokio（异步运行时）

## 开发环境要求

### 必需
1. **Node.js** - 推荐 18.x 或更高版本
2. **Rust** - Tauri 后端需要

### 安装 Rust

```bash
# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Windows
# 下载并运行 rustup-init.exe: https://rustup.rs/

# 验证安装
rustc --version
cargo --version
```

### Tauri 前置依赖

根据你的操作系统，需要安装相应的依赖：

**macOS:**
```bash
# 已包含在 Xcode Command Line Tools 中
xcode-select --install
```

**Windows:**
- 安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- 安装 [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

## 安装和运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 构建生产版本
npm run build

# 构建桌面应用
npm run tauri build
```

## 打包发布

运行 `npm run tauri build` 后，生成的安装包位于：

- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **Linux**: `src-tauri/target/release/bundle/deb/` 或 `appimage/`

## 项目结构

```
s3-gui/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   │   ├── UploadModal.tsx # 上传对话框
│   │   └── FilePreview.tsx # 文件预览
│   ├── pages/             # 页面组件
│   │   ├── ConnectionManager.tsx
│   │   ├── BucketList.tsx
│   │   └── FileBrowser.tsx
│   ├── services/          # API 服务
│   │   └── s3.ts
│   ├── store/             # Zustand 状态管理
│   ├── types/             # TypeScript 类型
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── commands/      # Tauri 命令
│   │   │   ├── bucket.rs
│   │   │   ├── object.rs
│   │   │   ├── upload.rs
│   │   │   ├── download.rs
│   │   │   └── multipart.rs
│   │   ├── s3/           # S3 客户端
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── README.md
```

## 使用说明

### 1. 添加连接配置

在"连接管理"页面添加 S3 连接：
- **连接名称**: 自定义名称
- **Access Key ID**: AWS 访问密钥 ID
- **Secret Access Key**: AWS 访问密钥
- **Region**: AWS 区域（如 us-east-1）
- **Endpoint**: 可选，用于 S3 兼容服务
- **Session Token**: 可选，临时凭证

### 2. 管理 Buckets

在"Bucket 列表"页面：
- 查看所有 Buckets
- 创建新 Bucket
- 删除空 Bucket
- 点击"打开"进入文件浏览器

### 3. 文件操作

在"文件浏览器"页面：
- **浏览**: 点击文件夹进入，使用面包屑返回
- **上传**: 点击"上传文件"按钮
- **下载**: 单文件下载或批量下载
- **重命名/复制/移动**: 通过更多操作菜单
- **删除**: 单文件删除或批量删除
- **搜索**: 顶部搜索框实时搜索文件名
- **排序/筛选**: 点击列标题排序，使用存储类型筛选

### 4. 大文件上传

超过 5MB 的文件将自动使用分片上传，确保大文件稳定传输。

## 待实现功能

- 预签名 URL 生成（临时分享链接）
- 断点续传
- 上传/下载队列管理
- 更多文件类型预览（视频、音频）
- 文件加密传输
- 操作历史记录

## 开发进度

查看 [TODO.md](./TODO.md) 了解完整的开发计划。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
