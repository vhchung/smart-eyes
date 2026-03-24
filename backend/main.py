import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.models.database import init_db, SessionLocal, Camera
from app.core.security import decrypt_credentials
from app.api import cameras, settings as settings_router, detections, snapshots, streaming, status
from app.services.webrtc import webrtc_service
from app.services.detection import detection_service

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cameras.router)
app.include_router(settings_router.router)
app.include_router(detections.router)
app.include_router(snapshots.router)
app.include_router(streaming.router)
app.include_router(status.router)


@app.on_event("startup")
def startup_event():
    logging.basicConfig(level=logging.DEBUG)
    init_db()

    # Load existing enabled cameras into WebRTC service
    db = SessionLocal()
    try:
        cameras = db.query(Camera).filter(Camera.enabled == True).all()
        logger.info(f"Startup: Found {len(cameras)} enabled cameras")
        for camera in cameras:
            # Use rtsp_url if available, otherwise fall back to stream_url
            rtsp_url = camera.rtsp_url or camera.stream_url
            logger.info(f"Startup: Processing camera id={camera.id}, name={camera.name}, rtsp_url={rtsp_url}")
            if rtsp_url:
                username = decrypt_credentials(camera.username_encrypted) if camera.username_encrypted else None
                password = decrypt_credentials(camera.password_encrypted) if camera.password_encrypted else None
                webrtc_service.add_camera(
                    str(camera.id),
                    rtsp_url,
                    username,
                    password,
                )
                logger.info(f"Startup: Added camera {camera.id} to WebRTC service")
            else:
                logger.info(f"Startup: Camera {camera.id} has no RTSP URL, skipping")
    finally:
        db.close()

    # Start detection service if enabled
    from app.core.config import settings
    if settings.DETECTION_ENABLED:
        asyncio.create_task(detection_service.start())
        logger.info("Startup: DetectionService started")


@app.on_event("shutdown")
async def shutdown_event():
    await detection_service.stop()
    await webrtc_service.close_all()


@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8118, reload=True)
