#!/bin/bash
# Smart Eyes Backend Startup Script
# Auto-start on login via launchd (MacOS)

# Use SMART_EYES_HOME if set, otherwise derive from script location
if [ -z "$SMART_EYES_HOME" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
else
    PROJECT_DIR="$SMART_EYES_HOME"
fi

BACKEND_DIR="$PROJECT_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"
LOG_DIR="$PROJECT_DIR/logs"

# Create directories if they don't exist
mkdir -p "$LOG_DIR" "$PROJECT_DIR/run"

# Activate virtual environment and start backend
cd "$BACKEND_DIR"

# Start the backend service
exec "$VENV_DIR/bin/uvicorn" \
    app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1 \
    --log-level info \
    >> "$LOG_DIR/backend.log" \
    2>> "$LOG_DIR/backend.error.log"
