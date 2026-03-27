# Smart Eyes

AI-powered security camera server with real-time person detection, Telegram notifications, and WebRTC streaming.

## Features

- **Real-time Camera Streaming** - WebRTC-based RTSP streaming with WebSocket JPEG frame delivery
- **AI Person Detection** - YOLOv8n for reliable person detection with BLIP image captioning
- **Smart Notifications** - Telegram Bot integration with snapshot images and Vietnamese translations
- **Region of Interest** - Configurable rectangular and polygon ROI for focused detection
- **Per-Camera Controls** - Individual detection and notification toggles per camera
- **Live Dashboard** - Multi-camera grid view with click-to-focus live streaming
- **Detection Logs** - Gallery view of detection events with filtering and snapshots
- **Credential Security** - AES-256-GCM encryption for stored camera credentials

## Tech Stack

### Backend

- **FastAPI** (Python 3.11+) - Async web framework
- **SQLAlchemy** + **SQLite** - Database ORM
- **aiortc** + **PyAV** - WebRTC/RTSP streaming
- **Ultralytics YOLOv8** - Person detection
- **Transformers BLIP** - Image captioning
- **Telegram Bot API** - Notifications

### Frontend

- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Zustand** - State management
- **Tailwind CSS v4** + **Radix UI** - UI components
- **React Router v7** - Client-side routing

## Project Structure

```
smart-eyes/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes (cameras, detections, settings, streaming)
│   │   ├── core/          # Config, security (AES encryption)
│   │   ├── models/        # SQLAlchemy models
│   │   └── services/      # Detection, notifications, streaming services
│   └── main.py            # FastAPI entry point
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages (Dashboard, Cameras, LiveView, Settings, Detections)
│   │   ├── stores/        # Zustand state stores
│   │   └── lib/           # API client, WebSocket, utilities
│   └── package.json
├── data/                  # SQLite database + snapshots
├── scripts/               # Startup scripts (launchd for macOS)
└── PROGRESS.md            # Development progress tracking
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Bun (optional, for faster package management)
- RTSP camera stream

### Backend Setup

```bash
cd backend
uv sync
```

Set the encryption key for credentials:

```bash
export ENCRYPTION_KEY="your-32-byte-hex-key"
```

Start the backend:

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8118
```

### Frontend Setup

```bash
cd frontend
bun install
bun run dev
```

### Development (Both)

From the project root:

```bash
bun run dev
```

This starts both frontend (http://localhost:3113) and backend (http://localhost:8118).

## Configuration

### Environment Variables

| Variable             | Description                                           | Default              |
| -------------------- | ----------------------------------------------------- | -------------------- |
| `ENCRYPTION_KEY`     | 32-byte hex key for AES-256-GCM credential encryption | Required             |
| `DATABASE_URL`       | SQLite database path                                  | `data/smart_eyes.db` |
| `SNAPSHOT_DIR`       | Directory for detection snapshots                     | `data/snapshots`     |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token                                | Per-camera setting   |

### Telegram Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your chat ID via [@userinfobot](https://t.me/userinfobot)
3. Add camera with Telegram enabled and provide bot token + chat ID

## API Endpoints

| Method | Endpoint                 | Description          |
| ------ | ------------------------ | -------------------- |
| GET    | `/api/cameras`           | List all cameras     |
| POST   | `/api/cameras`           | Add new camera       |
| PUT    | `/api/cameras/{id}`      | Update camera        |
| DELETE | `/api/cameras/{id}`      | Delete camera        |
| GET    | `/api/detections`        | List detection logs  |
| GET    | `/api/snapshots/{path}`  | Serve snapshot image |
| GET    | `/ws/stream/{camera_id}` | WebSocket stream     |
| GET    | `/api/settings`          | Get app settings     |
| PUT    | `/api/settings`          | Update settings      |

## macOS Auto-Start

For running the backend as a system service on macOS:

```bash
# Copy the plist to launchd
cp scripts/com.smart-eyes.backend.plist ~/Library/LaunchAgents/

# Load the service
launchctl load ~/Library/LaunchAgents/com.smart-eyes.backend.plist
```

## License

MIT
