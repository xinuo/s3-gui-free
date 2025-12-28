# S3 GUI

An S3 file browser built with Tauri + React + TypeScript, supporting complete S3 protocol operations.

## Features

### Connection Management
- Add/Edit/Delete S3 connection configurations
- Support for AWS S3 and S3-compatible services (MinIO, Alibaba Cloud OSS, Tencent Cloud COS, etc.)
- Secure local storage of connection information

### Bucket Management
- List all Buckets
- Create Bucket (with Region selection)
- Delete Bucket
- Quick open Bucket to enter file browser

### File Browsing & Operations
- **File Browsing**
  - Browse files and folders in Buckets
  - Breadcrumb navigation for quick return to parent directories
  - File list display (name, size, last modified, storage class)
  - Click folders to enter subdirectories
  - Multi-select for batch operations

- **File Operations**
  - Rename files
  - Copy files
  - Move files
  - Delete files/objects
  - Multi-select batch download
  - Multi-select batch delete

- **Search & Filter**
  - Real-time filename search
  - Sort by file size
  - Sort by modification time
  - Filter by storage class

### File Upload
- Single file upload
- Batch upload
- Drag & drop upload
- **Multipart upload** (automatically enabled for files > 5MB)
- Upload progress display

### File Download
- Single file download (choose save location)
- Batch download (select target directory)
- Download progress indication

### File Preview
- Image file preview (supports jpg, png, gif, webp, svg, etc.)
- Text file preview (supports txt, md, json, xml, code files, etc.)
- File information display

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite
- Ant Design 5 (UI component library)
- Zustand (state management)
- Day.js (date handling)

### Backend
- Rust
- Tauri 2
- AWS SDK for Rust (S3 client)
- Tokio (async runtime)

## Development Requirements

### Required
1. **Node.js** - Version 18.x or higher recommended
2. **Rust** - Required for Tauri backend

### Install Rust

```bash
# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Windows
# Download and run rustup-init.exe: https://rustup.rs/

# Verify installation
rustc --version
cargo --version
```

### Tauri Prerequisites

Depending on your operating system, you need to install the following dependencies:

**macOS:**
```bash
# Included in Xcode Command Line Tools
xcode-select --install
```

**Windows:**
- Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

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

## Installation & Running

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run build

# Build desktop application
npm run tauri build
```

## Packaging & Release

After running `npm run tauri build`, the generated installation packages are located at:

- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **Linux**: `src-tauri/target/release/bundle/deb/` or `appimage/`

## Project Structure

```
s3-gui/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   │   ├── UploadModal.tsx # Upload dialog
│   │   └── FilePreview.tsx # File preview
│   ├── pages/             # Page components
│   │   ├── ConnectionManager.tsx
│   │   ├── BucketList.tsx
│   │   └── FileBrowser.tsx
│   ├── services/          # API services
│   │   └── s3.ts
│   ├── store/             # Zustand state management
│   ├── types/             # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/      # Tauri commands
│   │   │   ├── bucket.rs
│   │   │   ├── object.rs
│   │   │   ├── upload.rs
│   │   │   ├── download.rs
│   │   │   └── multipart.rs
│   │   ├── s3/           # S3 client
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── README.md
```

## Usage Guide

### 1. Add Connection Configuration

Add S3 connection in the "Connection Management" page:
- **Connection Name**: Custom name
- **Access Key ID**: AWS access key ID
- **Secret Access Key**: AWS secret access key
- **Region**: AWS region (e.g., us-east-1)
- **Endpoint**: Optional, for S3-compatible services
- **Session Token**: Optional, for temporary credentials

### 2. Manage Buckets

On the "Bucket List" page:
- View all Buckets
- Create new Bucket
- Delete empty Bucket
- Click "Open" to enter file browser

### 3. File Operations

In the "File Browser" page:
- **Browse**: Click folders to enter, use breadcrumbs to return
- **Upload**: Click "Upload File" button
- **Download**: Single file download or batch download
- **Rename/Copy/Move**: Through the more actions menu
- **Delete**: Single file delete or batch delete
- **Search**: Real-time filename search in top search box
- **Sort/Filter**: Click column headers to sort, use storage class filter

### 4. Large File Upload

Files larger than 5MB will automatically use multipart upload to ensure stable transmission.

## Roadmap

- Presigned URL generation (temporary sharing links)
- Resumable upload/download
- Upload/Download queue management
- More file type previews (video, audio)
- Encrypted file transfer
- Operation history

## Development Progress

See [TODO.md](./TODO.md) for the complete development plan.

## License

MIT License

## Contributing

Issues and Pull Requests are welcome!
