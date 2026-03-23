import asyncio
import base64
import io
import logging
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional

from app.services.webrtc import webrtc_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/streaming", tags=["streaming"])


class AnswerRequest(BaseModel):
    sdp: str


@router.get("/streams")
def list_streams():
    """List available active streams."""
    active_cameras = webrtc_service.get_active_cameras()
    return {"streams": active_cameras}


@router.get("/webrtc/{camera_id}")
async def get_webrtc_offer(camera_id: str):
    """Get WebRTC SDP offer for a camera."""
    logger.info(f"get_webrtc_offer called for camera_id={camera_id}")

    try:
        logger.info(f"Creating offer for camera {camera_id}")
        offer_sdp, returned_camera_id = await webrtc_service.create_offer(camera_id)
        logger.info(f"Offer created successfully for camera {camera_id}, SDP length={len(offer_sdp)}")
        return {"camera_id": returned_camera_id, "offer": offer_sdp}
    except ValueError as e:
        logger.error(f"Camera not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create offer: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create offer: {type(e).__name__}: {str(e)}")


@router.post("/webrtc/{camera_id}/answer")
async def submit_webrtc_answer(camera_id: str, request: AnswerRequest):
    """Submit WebRTC answer SDP from client."""
    try:
        result = await webrtc_service.handle_answer(camera_id, request.sdp)
        if result and result.get("status") == "ignored":
            return result
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to handle answer: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to handle answer: {str(e)}")


@router.delete("/webrtc/{camera_id}")
async def close_webrtc_connection(camera_id: str):
    """Close WebRTC connection for a camera."""
    try:
        await webrtc_service.close_camera(camera_id)
        return {"status": "closed"}
    except Exception as e:
        logger.error(f"Failed to close connection: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to close connection: {str(e)}")


@router.websocket("/ws/{camera_id}")
async def websocket_stream(websocket: WebSocket, camera_id: str):
    """WebSocket endpoint for streaming camera frames."""
    await websocket.accept()
    logger.info(f"WebSocket connected for camera {camera_id}")

    # Get camera RTSP URL from service or database
    rtsp_url = None
    username = None
    password = None

    if camera_id in webrtc_service._rtsp_urls:
        rtsp_url, username, password = webrtc_service._rtsp_urls[camera_id]
    else:
        # Try to get from database
        from app.models.database import SessionLocal, Camera
        from app.core.security import decrypt_credentials
        db = SessionLocal()
        try:
            camera = db.query(Camera).filter(Camera.id == int(camera_id)).first()
            if camera and camera.enabled:
                rtsp_url = camera.rtsp_url or camera.stream_url
                if camera.username_encrypted:
                    username = decrypt_credentials(camera.username_encrypted)
                if camera.password_encrypted:
                    password = decrypt_credentials(camera.password_encrypted)
                # Add to webrtc_service for future reference
                if rtsp_url:
                    webrtc_service.add_camera(camera_id, rtsp_url, username, password)
        finally:
            db.close()

    if not rtsp_url:
        await websocket.send_json({"error": "Camera not found or not enabled"})
        await websocket.close()
        return

    logger.info(f"Starting WebSocket stream for camera {camera_id} from {rtsp_url}")

    container = None
    try:
        import av
        import cv2
        import numpy as np

        # Build RTSP URL with credentials if provided
        stream_url = rtsp_url
        if username and password:
            if rtsp_url.startswith('rtsp://'):
                stream_url = rtsp_url.replace('rtsp://', f'rtsp://{username}:{password}@')

        container = av.open(stream_url, format='rtsp', options={
            'rtsp_transport': 'tcp',
            'threads': '2',
        })
        stream = container.streams.video[0]

        logger.info(f"Opened RTSP stream for camera {camera_id}")

        # Read and send frames
        frame_count = 0
        last_sent_time = 0
        frame_interval = 0.1  # Send at most 10 FPS (100ms between frames)

        # Log stream properties
        logger.info(f"Camera {camera_id} stream: {stream.width}x{stream.height}, codec: {stream.codec_context.name}")

        while True:
            try:
                for packet in container.demux(stream):
                    for frame in packet.decode():
                        if frame is not None:
                            # Throttle frame rate
                            import time
                            current_time = time.time()
                            if current_time - last_sent_time < frame_interval:
                                continue
                            last_sent_time = current_time

                            # Convert frame to numpy array (BGR format for OpenCV)
                            img = frame.to_ndarray(format='bgr24')

                            # Encode as JPEG using OpenCV
                            ret, jpeg_data = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 70])
                            if ret:
                                b64_data = base64.b64encode(jpeg_data).decode('utf-8')
                                await websocket.send_json({
                                    "type": "frame",
                                    "data": b64_data,
                                    "timestamp": frame.pts if hasattr(frame, 'pts') else frame_count,
                                })
                                frame_count += 1

                            await asyncio.sleep(0)  # Yield to event loop
            except av.error.InvalidDataError as e:
                logger.warning(f"Invalid data error for camera {camera_id}, retrying: {e}")
                await asyncio.sleep(1)
                continue
            except Exception as e:
                logger.error(f"Stream error for camera {camera_id}: {e}")
                break

    except Exception as e:
        logger.error(f"Failed to start stream for camera {camera_id}: {e}")
        await websocket.send_json({"error": str(e)})
    finally:
        if container:
            try:
                container.close()
            except Exception:
                pass
        await websocket.close()
        logger.info(f"WebSocket closed for camera {camera_id}")
