# WarpFS - Browser-based File System

A modern, secure, and feature-rich file system interface for the browser, built with React, TypeScript, and Node.js to manage files on your VPS and access the CDN.

## Features

### 🎨 Modern UI/UX
- Clean and intuitive interface built with shadcn/ui components

### VPS Requirements
- **Memory**: Minimum 512MB RAM for handling concurrent uploads
- **Storage**: Sufficient disk space for user files and temporary chunk storage
- **Network**: Optimized for connections with 30MB upload capacity
- **Node.js**: Version 14 or higher required

### Performance Optimization
The system is specifically optimized for VPS environments:
- Smart upload strategy based on file size
- Automatic cleanup of temporary files
- Session-based progress tracking to prevent memory leaks
- HTTP compression for API responses
- Concurrent chunk processing with configurable limits

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).e built with shadcn/ui components
- Responsive design that works on desktop and mobile devices
- Dark/light theme support
- Smooth animations powered by GSAP
- Resizable panels for optimal workspace management
- Real-time upload progress visualization with speed indicators

### 📁 File Management
- Create, delete, rename, and move files and folders
- Multi-file selection with bulk operations
- Advanced file upload system with drag-and-drop support
- **High-speed chunked uploads** for large files (10GB+)
- **Parallel upload processing** optimized for VPS connections
- Real-time upload progress with speed tracking and time estimates
- Upload cancellation with automatic cleanup
- File preview and download capabilities
- Breadcrumb navigation with quick folder switching
- Advanced search functionality
- Public/private file sharing with secure links

### 🚀 Advanced Upload System
- **Smart Upload Strategy**: Automatically chooses optimal method based on file size
- **Chunked Upload**: Large files split into 5MB chunks for reliability
- **Parallel Processing**: Up to 4 simultaneous chunk uploads for maximum speed
- **Real-time Progress**: Live speed monitoring, time estimates, and transfer statistics
- **Upload Cancellation**: Cancel uploads mid-process with automatic cleanup
- **Error Recovery**: Robust error handling with retry capabilities
- **Memory Optimized**: Efficient disk-based storage for large file handling
- **VPS Optimized**: Specially configured for 30MB upload connections

### 🔐 Security & Authentication
- User registration and login system
- Secure file storage with complete user isolation
- Public/private file access control
- API authentication using headers (user, pass, id)
- Path traversal protection and input validation
- Error boundary for robust error handling
- Secure public file sharing system

### ⚡ Performance Optimizations
- HTTP compression for faster response times
- Hot Module Replacement (HMR) for fast development
- Optimized file operations with streaming
- Lazy loading of file contents
- Efficient state management with React Context
- Background cleanup of temporary files
- Automatic session management for uploads

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling
- **shadcn/ui** for component library
- **GSAP** for animations
- **Lucide React** for icons

### Backend
- **Node.js** with Express.js
- **Advanced file upload system** with multer and chunked processing
- **Real-time progress tracking** with session management
- **HTTP compression** for optimized transfer speeds
- **File system** based storage with atomic operations
- **JSON** for user data persistence
- **CORS** enabled for cross-origin requests
- **Background cleanup** for temporary files and stale sessions

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/VMASPAD/WarpFS
cd WarpFS
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
npm install
cd ..
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm run serve
```
The backend will run on `http://localhost:9876`

2. Start the frontend development server:
```bash
npm run dev
```
The frontend will run on `http://localhost:5173`

3. Open your browser and navigate to `http://localhost:5173`

# Deploy (Docker and Coolify)

```bash
# ---------- Base image with Node and Git ----------
FROM node:20-alpine AS base

# Install Git and utilities
RUN apk add --no-cache git bash curl

# Build args (override with --build-arg)
ARG REPO_URL="https://github.com/VMASPAD/WarpFS"
ARG REPO_BRANCH="main"

# App directory
ENV APP_DIR=/app
WORKDIR ${APP_DIR}

# Clone repository (specific branch if needed)
RUN git clone --depth=1 --branch "${REPO_BRANCH}" "${REPO_URL}" ./

# ---------- Install dependencies ----------
RUN if [ -f package.json ]; then \
      corepack enable && corepack prepare pnpm@latest --activate || true; \
      if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
      elif [ -f package-lock.json ]; then npm ci; \
      elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
      else npm install; fi; \
    fi

# Optional second service folder (e.g. "backend")
ARG SECOND_DIR="backend"

RUN if [ -d "${SECOND_DIR}" ] && [ -f "${SECOND_DIR}/package.json" ]; then \
      cd "${SECOND_DIR}" && \
      if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
      elif [ -f package-lock.json ]; then npm ci; \
      elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
      else npm install; fi; \
    fi

# ---------- Runtime ----------
ENV FIRST_CMD="npm run dev" \
    SECOND_CMD="npm run serve" \
    SECOND_DIR="${SECOND_DIR}" \
    HOST="0.0.0.0" \
    PORT="6043" \
    SECOND_PORT="9876"

EXPOSE 6043 9876

# Startup script
RUN printf '%s\n' \
'#!/usr/bin/env bash' \
'set -euo pipefail' \
'' \
'cd "${APP_DIR}"' \
'echo "[start] Running: ${FIRST_CMD}"' \
'( export HOST="${HOST}" PORT="${PORT}"; eval "${FIRST_CMD}" ) & PID1=$!' \
'' \
'if [ -d "${SECOND_DIR}" ]; then' \
'  cd "${APP_DIR}/${SECOND_DIR}"' \
'  echo "[start] Running: ${SECOND_CMD}"' \
'  ( export HOST="${HOST}" PORT="${SECOND_PORT}"; eval "${SECOND_CMD}" ) & PID2=$!' \
'else' \
'  PID2=""' \
'fi' \
'' \
'trap "kill -TERM ${PID1} ${PID2} 2>/dev/null || true; wait || true" SIGINT SIGTERM' \
'' \
'if [ -n "${PID2:-}" ]; then wait -n ${PID1} ${PID2}; else wait ${PID1}; fi' \
> /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh

CMD ["/usr/local/bin/start.sh"]
```

## Domain assignment

```traefik
traefik.enable=true

# Middlewares globales
traefik.http.middlewares.gzip.compress=true
traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https

# ---------- FRONTEND ----------
traefik.http.routers.http-frontend.entryPoints=http
traefik.http.routers.http-frontend.rule=Host(`domain.example.com`) && PathPrefix(`/`)
traefik.http.routers.http-frontend.middlewares=redirect-to-https
traefik.http.routers.http-frontend.service=frontend-http-svc

traefik.http.routers.https-frontend.entryPoints=https
traefik.http.routers.https-frontend.rule=Host(`domain.example.com`) && PathPrefix(`/`)
traefik.http.routers.https-frontend.tls=true
traefik.http.routers.https-frontend.tls.certresolver=letsencrypt
traefik.http.routers.https-frontend.middlewares=gzip
traefik.http.routers.https-frontend.service=frontend-https-svc

traefik.http.services.frontend-http-svc.loadbalancer.server.port=6043
traefik.http.services.frontend-https-svc.loadbalancer.server.port=6043

# ---------- BACKEND (hidden under /api/* of the same host) ----------
# Router backend bajo el mismo dominio del frontend
traefik.http.routers.https-backend.entryPoints=https
traefik.http.routers.https-backend.rule=Host(`domain.example.com`) && PathPrefix(`/api`)
traefik.http.routers.https-backend.tls=true
traefik.http.routers.https-backend.tls.certresolver=letsencrypt

# Middlewares
traefik.http.middlewares.backend-strip.stripprefix.prefixes=/api
traefik.http.middlewares.backend-gzip.compress=true
traefik.http.routers.https-backend.middlewares=backend-strip,backend-gzip

# Service del backend
traefik.http.services.backend-svc.loadbalancer.server.port=9876
traefik.http.routers.https-backend.service=backend-svc

```

## Usage

### First Time Setup
1. Open the application in your browser
2. Click on the "Register" tab
3. Create a new account with username and password
4. Login with your credentials

### File Operations
- **Create File**: Click "Create File" button, enter filename
- **Create Folder**: Click "Create Folder" button, enter folder name
- **Upload Files**: Drag & drop files/folders or use "Select Files"/"Select Folder" buttons
  - **Large File Upload**: Automatic chunked upload with real-time progress
  - **Upload Progress**: See live speed, time remaining, and data transferred
  - **Cancel Upload**: Stop uploads mid-process with cleanup
- **Navigate**: Double-click folders to enter them, use breadcrumbs or "Go Up" button
- **Select Files**: Use checkboxes to select multiple files for bulk operations
- **View Files**: Double-click files or use the dropdown menu "View" option
- **Rename**: Use dropdown menu → "Rename"
- **Move**: Use dropdown menu → "Move" 
- **Delete**: Use dropdown menu → "Delete" or select multiple and use "Delete Selected"
- **Public Sharing**: Use dropdown menu → "Make Public" to generate shareable links
- **Copy Public Link**: For public files, copy direct access links

### API Access

#### File Download
Files can be accessed via API using the archive endpoint:
```http
GET /archive
Headers:
  user: <username>
  pass: <password>
  id: <user-id>

Body:
{
  "path": "/test/test.json"
}
```

#### Public File Access
Public files can be accessed without authentication:
```http
GET /public/<file-id>
```

#### Upload Progress Monitoring
Monitor upload progress in real-time:
```http
GET /api/upload-progress/<session-id>
Headers:
  user: <username>
  pass: <password>
  id: <user-id>
```

#### Chunked Upload Endpoints
For large file uploads (automatically used by the frontend):
- `POST /upload-chunked/init` - Initialize upload session
- `POST /upload-chunked/chunk` - Upload individual chunks
- `POST /upload-chunked/finalize` - Combine chunks into final file
- `DELETE /upload-chunked/cancel/<session-id>` - Cancel active upload

## Project Structure

```
WarpFS/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── AuthForm.tsx          # Login/Register form
│   │   ├── ErrorBoundary.tsx     # Error handling wrapper
│   │   ├── FileViewer.tsx        # File preview component
│   │   ├── FileOperations.tsx    # File management operations
│   │   ├── UploadZone.tsx        # Drag & drop upload interface
│   │   └── UploadProgress.tsx    # Real-time upload progress display
│   ├── contexts/
│   │   └── FileSystemContext.tsx # Global state management
│   ├── hooks/
│   │   ├── useFileSystemOperations.ts  # File operation hooks
│   │   └── use-mobile.ts              # Mobile detection utility
│   ├── services/
│   │   └── fileSystemAPI.ts      # API communication layer
│   ├── views/
│   │   └── FileSystem.tsx        # Main file system interface
│   └── App.tsx                   # Application root component
├── backend/
│   ├── index.js                  # Express server with upload system
│   ├── db.json                   # User data storage
│   ├── public-files.json         # Public file metadata
│   ├── temp/                     # Temporary storage for chunks
│   └── package.json
└── README.md
```

## Development

### Available Scripts

Frontend:
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

Backend:
- `npm run serve` - Start development server with nodemon

### Environment Variables

Create a `.env` file in the backend directory:
```env
PORT=9876
```

## Security Features

- User authentication with secure credential verification
- File access isolation (users can only access their own files)
- Path traversal protection
- Input validation and sanitization
- Error handling with user-friendly messages

## Roadmap

- [x] File upload via drag & drop
- [x] Advanced file preview (images, videos, code)
- [ ] File compression/archiving 
- [ ] Advanced search with filters  
- [x] File permissions system  

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**WarpFS** - Bringing modern file management to your VPS! 🚀