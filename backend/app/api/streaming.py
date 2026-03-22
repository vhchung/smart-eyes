from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings

router = APIRouter(prefix="/streaming", tags=["streaming"])


class StreamInfo(BaseModel):
    camera_id: int
    source: str
    status: str


@router.get("/go2rtc/streams")
def list_go2rtc_streams():
    """List available streams from go2rtc."""
    import aiohttp
    import asyncio

    async def fetch_streams():
        url = f"http://{settings.GO2RTC_HOST}:{settings.GO2RTC_PORT}/api/streams"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    return {}
        except Exception:
            return {}

    streams = asyncio.run(fetch_streams())
    return streams


@router.get("/go2rtc/webrtc/{camera_id}")
def get_webrtc_stream(camera_id: int):
    """Get WebRTC stream URL for a camera."""
    from app.models.database import SessionLocal, Camera

    db = SessionLocal()
    try:
        camera = db.query(Camera).filter(Camera.id == camera_id).first()
        if not camera:
            raise HTTPException(status_code=404, detail="Camera not found")

        return {
            "camera_id": camera_id,
            "stream_url": f"http://{settings.GO2RTC_HOST}:{settings.GO2RTC_PORT}/stream.html?src={camera_id}",
            "ws_url": f"ws://{settings.GO2RTC_HOST}:{settings.GO2RTC_PORT}/stream/{camera_id}",
        }
    finally:
        db.close()


@router.post("/go2rtc/restart")
def restart_go2rtc():
    """Restart go2rtc service."""
    import subprocess

    try:
        subprocess.run(["systemctl", "restart", "go2rtc"], check=True)
        return {"message": "go2rtc restart requested"}
    except subprocess.CalledProcessError:
        return {"message": "Failed to restart go2rtc (may require sudo)"}
    except FileNotFoundError:
        return {"message": "systemctl not found"}
