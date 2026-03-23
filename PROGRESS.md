# Smart Eyes v3.0 - Implementation Progress

## Session Summary (2026-03-23)

### Work Completed

1. **Replaced go2rtc with aiortc/WebSocket streaming**
   - Backend: WebSocket endpoint streams JPEG frames from RTSP cameras
   - Frontend: LiveView page displays multi-camera grid with click-to-focus

2. **Key Files Created**
   - `backend/app/services/webrtc.py` - WebRTC service with PyAV RTSP decoding
   - `frontend/src/lib/websocket.ts` - WebSocket client helper
   - `frontend/src/pages/LiveView.tsx` - Multi-camera live streaming UI

3. **Key Dependencies Added**
   - `aiortc`, `av`, `opencv-python`, `websockets` to backend
   - Vite proxy configured for `/api` and `/streaming/ws`

4. **Issues Resolved**
   - Fixed asyncio event loop issues in sync endpoints
   - Fixed RTCPeerConnection configuration with RTCConfiguration/RTCIceServer
   - Added websockets library for uvicorn WebSocket support
   - Fixed PIL import error by using OpenCV for JPEG encoding

5. **Known Limitation**
   - HEVC/H.265 cameras (via-he) are CPU-intensive to decode
   - Solution: Click to focus single camera to reduce frontend load

---

## Overview

AI Security Server with FastAPI backend and React frontend (Vite/BunJS).

---

## Phase 1: Backend Setup

### 2026-03-22 23:20 - Project Initialization

- Created project directory structure at `/media/chungvh/KINGSTON1/Projects/smart-eyes`
- Initialized `uv` project in `backend/` directory
- Created `data/` directory for SQLite database and snapshots

### 2026-03-22 23:24 - Dependencies Installation

Installed packages:

- fastapi, uvicorn, sqlalchemy, alembic, cryptography, aiohttp, python-multipart, pydantic-settings

### 2026-03-22 23:27 - Backend Structure Created

Created directory structure:

- `app/api/` - API routes
- `app/core/` - Security and config
- `app/models/` - SQLAlchemy models
- `app/services/` - Business logic
- `migrations/` - Alembic migrations

### 2026-03-22 23:30 - Core Configuration

- `app/core/config.py` - Pydantic settings with environment variable support
- `app/core/security.py` - AES-256-GCM encryption utility for credential storage

### 2026-03-22 23:35 - Database Models

Created `app/models/database.py` with SQLAlchemy models:

- `Camera` - Camera configurations with ROI and detection settings
- `DetectionLog` - AI detection events
- `Snapshot` - Captured images
- `SettingsModel` - Key-value settings storage

### 2026-03-22 23:40 - API Routes

Created `app/api/` routes:

- `cameras.py` - Full CRUD for camera management
- `settings.py` - Settings retrieval and update
- `detections.py` - Detection logs listing and deletion
- `snapshots.py` - Snapshot management and cleanup
- `streaming.py` - go2rtc WebRTC integration

### 2026-03-22 23:45 - Services

- `app/services/telegram.py` - Telegram notification service with async message/photo sending

### 2026-03-22 23:50 - Main Application

- `main.py` - FastAPI application with CORS middleware and all routers included
- `migrations/` - Alembic initialized for database migrations
- `.env` - Environment variables template

---

## Phase 2: Frontend Setup

### 2026-03-23 00:15 - Project Initialization

- Created Vite React TypeScript project with Bun
- Installed all base dependencies

### 2026-03-23 00:17 - UI Dependencies

Installed:

- tailwindcss, @tailwindcss/vite, next-themes, react-router-dom, zustand, lucide-react
- class-variance-authority, clsx, tailwind-merge
- Radix UI primitives: dialog, dropdown-menu, label, slider, switch, slot, tabs, tooltip, select, separator

### 2026-03-23 00:19 - Configuration Updates

- `vite.config.ts` - Added Tailwind plugin and `@/` path alias
- `tsconfig.app.json` - Added path mapping for `@/*`
- `src/index.css` - Tailwind v4 with dark mode theme using CSS custom properties

### 2026-03-23 00:20 - UI Components

Created shadcn/ui-style components in `src/components/ui/`:

- `button.tsx` - Button with variants (default, destructive, outline, secondary, ghost, link)
- `card.tsx` - Card components (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- `input.tsx` - Styled input component
- `label.tsx` - Label with Radix integration
- `slider.tsx` - Range slider with Radix
- `switch.tsx` - Toggle switch with Radix
- `dialog.tsx` - Modal dialog with overlay
- `tabs.tsx` - Tabbed interface
- `tooltip.tsx` - Tooltip with Radix

### 2026-03-23 00:21 - Utilities and API Client

- `src/lib/utils.ts` - `cn()` utility for Tailwind class merging
- `src/lib/api.ts` - TypeScript API client with typed endpoints for cameras, settings, detections, streaming

### 2026-03-23 00:22 - State Management (Zustand)

Created stores:

- `stores/cameraStore.ts` - Camera state with CRUD operations
- `stores/settingsStore.ts` - Settings state management
- `stores/detectionStore.ts` - Detection logs state

### 2026-03-23 00:23 - Pages

Created pages:

- `pages/Layout.tsx` - Main layout with sidebar navigation and theme toggle
- `pages/Dashboard.tsx` - Dashboard with stats cards and camera/detection overviews
- `pages/Cameras.tsx` - Camera management with CRUD dialog and ROI modal
- `pages/Settings.tsx` - Settings page for Telegram, go2rtc, and storage configuration
- `pages/Detections.tsx` - Detection logs gallery with filtering and image preview

### 2026-03-23 00:24 - Components

- `components/SplashScreen.tsx` - Animated splash screen with progress bar and status messages

### 2026-03-23 00:25 - App Entry

- `App.tsx` - Main app with router, theme provider, and conditional splash screen
- `index.html` - Updated title and favicon

### 2026-03-23 00:26 - Build Verification

- Frontend builds successfully with `bun run build`
- All TypeScript errors resolved

---

## Phase 3: Git and Pre-commit Hooks

### 2026-03-23 00:20 - Git Repository Setup

- Moved git repository from `backend/` to project root for unified monorepo

### 2026-03-23 00:26 - Husky Configuration

- Initialized husky at project root
- Created `.husky/pre-commit` hook

### 2026-03-23 00:33 - Prettier Integration

- Added `prettier` to devDependencies at project root
- Added `lint-staged` for running prettier on staged files
- Added `husky` for git hooks
- Created `.prettierrc` with config: semi, singleQuote, tabWidth: 2, trailingComma: "es5", printWidth: 100
- Created `.prettierignore` for node_modules, dist, .venv, git, data
- Updated `.husky/pre-commit` to use local `lint-staged` binary

---

## Project Structure

```
smart-eyes/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cameras.py
│   │   │   ├── detections.py
│   │   │   ├── settings.py
│   │   │   ├── snapshots.py
│   │   │   └── streaming.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   └── database.py
│   │   └── services/
│   │       ├── telegram.py
│   │       └── webrtc.py      # NEW: WebRTC/RTSP streaming service
│   ├── migrations/
│   ├── main.py
│   ├── alembic.ini
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── slider.tsx
│   │   │   │   ├── switch.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   └── tooltip.tsx
│   │   │   └── SplashScreen.tsx
│   │   ├── pages/
│   │   │   ├── Cameras.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Detections.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── LiveView.tsx    # NEW: Live streaming page
│   │   │   └── Settings.tsx
│   │   ├── stores/
│   │   │   ├── cameraStore.ts
│   │   │   ├── detectionStore.ts
│   │   │   └── settingsStore.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── utils.ts
│   │   │   ├── websocket.ts    # NEW: WebSocket client helper
│   │   │   └── webrtc.ts       # NEW: WebRTC client (legacy)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── dist/
│   ├── node_modules/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.app.json
├── data/
├── .git/
├── .husky/
│   └── pre-commit
├── .prettierrc
├── .prettierignore
├── package.json
└── PROGRESS.md
```

---

## Commands

### Backend

```bash
cd backend
uv run main.py
```

### Frontend

```bash
cd frontend
bun run dev
bun run build
```

---

## Phase 4: Streaming Migration (go2rtc → aiortc/WebSocket)

### 2026-03-23 - Migration Overview

**Decision:** Replace go2rtc sidecar with Python-based RTSP→WebRTC streaming using aiortc and WebSocket.

**Reason:** go2rtc integration had issues with camera sync, manual configuration, and WebRTC ICE negotiation failures.

### 2026-03-23 - Backend Changes

**`pyproject.toml`** - Added dependencies:

- `aiortc>=1.9.0` - WebRTC peer connection handling
- `av>=12.0.0` - PyAV for RTSP stream decoding
- `opencv-python>=4.8.0` - JPEG frame encoding
- `websockets>=12.0` - WebSocket support

**`app/core/config.py`** - Removed go2rtc settings:

- Removed `GO2RTC_HOST` and `GO2RTC_PORT`

**`app/api/streaming.py`** - Complete rewrite:

- Removed all go2rtc endpoints (`/go2rtc/streams`, `/go2rtc/webrtc/{id}`, `/go2rtc/restart`)
- New WebSocket endpoint `/streaming/ws/{camera_id}` for JPEG frame streaming
- `/streaming/webrtc/{camera_id}` - Get SDP offer for WebRTC
- `/streaming/webrtc/{camera_id}/answer` - Submit WebRTC answer
- `/streaming/webrtc/{camera_id}` DELETE - Close connection

**`app/api/cameras.py`** - Added WebRTC service sync:

- `add_camera()` called on create with RTSP URL
- `remove_camera()` called on delete
- `add_camera()`/`remove_camera()` called on update with RTSP URL changes
- Falls back to `stream_url` if `rtsp_url` is empty

**`app/services/webrtc.py`** (NEW):

- `CameraStreamTrack` - Reads RTSP frames using PyAV, queues frames
- `WebRTCService` - Manages peer connections and RTSP URLs
- `create_offer()` - Creates WebRTC SDP offer with ICE servers
- `handle_answer()` - Processes client answer SDP

**`main.py`** - Lifecycle management:

- Startup: Loads existing enabled cameras into WebRTC service
- Shutdown: Closes all WebRTC connections

**`app/api/settings.py`** - Removed go2rtc configuration

**`.env`** - Removed `GO2RTC_HOST` and `GO2RTC_PORT`

### 2026-03-23 - Frontend Changes

**`vite.config.ts`** - Proxy configuration:

- `/api` → backend with path rewrite
- `/streaming/ws` → backend with WebSocket support

**`src/lib/api.ts`** - Updated streaming API:

- `getStreams()` → `/streaming/streams`
- `getWebRTC(cameraId)` → `/streaming/webrtc/{cameraId}` (returns SDP offer)
- `submitAnswer(cameraId, answer)` → POST `/streaming/webrtc/{cameraId}/answer`
- `closeConnection(cameraId)` → DELETE `/streaming/webrtc/{cameraId}`
- Removed go2rtc fields from Settings interface

**`src/lib/websocket.ts`** (NEW):

- `createWebSocketConnection()` - Connects to `/streaming/ws/{cameraId}`
- `closeWebSocketConnection()` - Closes WebSocket
- Handles base64 JPEG frame messages

**`src/pages/LiveView.tsx`** (NEW):

- Multi-camera grid live streaming page at `/live`
- WebSocket-based JPEG frame display
- Click to focus single camera (closes other connections)
- Stop button to disconnect focused camera
- Back to Grid button to reconnect all
- Auto-connects first 2 cameras only to reduce load

**`src/pages/Layout.tsx`** - Added "Live" nav item with Play icon

**`src/pages/Settings.tsx`** - Removed go2rtc configuration card

**`src/App.tsx`** - Added `/live` route for LiveView

### 2026-03-23 - Known Issues

**HEVC/H.265 Lag:** The via-he camera uses HEVC codec which is CPU-intensive to decode. Options:

1. Lower camera resolution in camera's web interface
2. Use hardware-accelerated decoding (not implemented)
3. Accept lower FPS for HEVC streams

---

## Status: Phase 1-4 Complete

Core streaming implemented. Live view page working with WebSocket-based JPEG streaming. Known limitation: HEVC streams may lag on CPU-only systems.
