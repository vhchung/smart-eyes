from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
import base64
import io

from app.models.database import Camera, get_db
from app.core.security import encrypt_credentials, decrypt_credentials
from app.services.webrtc import webrtc_service
from app.services.detection import detection_service

router = APIRouter(prefix="/cameras", tags=["cameras"])


class CameraCreate(BaseModel):
    name: str
    stream_url: str
    rtsp_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    enabled: bool = True
    detection_enabled: bool = True
    notification_enabled: bool = True
    roi_x: int = 0
    roi_y: int = 0
    roi_width: int = 0
    roi_height: int = 0
    roi_polygon: Optional[list[dict[str, float]]] = None
    detection_sensitivity: float = 0.5

    @field_validator('roi_polygon')
    @classmethod
    def validate_polygon(cls, v):
        if v is not None and len(v) < 3:
            raise ValueError('Polygon must have at least 3 points')
        if v is not None:
            for point in v:
                if not (0 <= point.get('x', -1) <= 1 and 0 <= point.get('y', -1) <= 1):
                    raise ValueError('Polygon coordinates must be normalized (0-1)')
        return v


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    stream_url: Optional[str] = None
    rtsp_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    enabled: Optional[bool] = None
    detection_enabled: Optional[bool] = None
    notification_enabled: Optional[bool] = None
    roi_x: Optional[int] = None
    roi_y: Optional[int] = None
    roi_width: Optional[int] = None
    roi_height: Optional[int] = None
    roi_polygon: Optional[list[dict[str, float]]] = None
    detection_sensitivity: Optional[float] = None

    @field_validator('roi_polygon')
    @classmethod
    def validate_polygon(cls, v):
        if v is not None and len(v) < 3:
            raise ValueError('Polygon must have at least 3 points')
        if v is not None:
            for point in v:
                if not (0 <= point.get('x', -1) <= 1 and 0 <= point.get('y', -1) <= 1):
                    raise ValueError('Polygon coordinates must be normalized (0-1)')
        return v


class CameraResponse(BaseModel):
    id: int
    name: str
    stream_url: str
    rtsp_url: Optional[str]
    enabled: bool
    detection_enabled: bool
    notification_enabled: bool
    roi_x: int
    roi_y: int
    roi_width: int
    roi_height: int
    roi_polygon: Optional[list[dict[str, float]]]
    detection_sensitivity: float

    class Config:
        from_attributes = True


@router.get("", response_model=list[CameraResponse])
def list_cameras(db: Session = Depends(get_db)):
    cameras = db.query(Camera).all()
    return cameras


@router.post("", response_model=CameraResponse)
def create_camera(camera: CameraCreate, db: Session = Depends(get_db)):
    db_camera = Camera(
        name=camera.name,
        stream_url=camera.stream_url,
        rtsp_url=camera.rtsp_url,
        username_encrypted=encrypt_credentials(camera.username) if camera.username else None,
        password_encrypted=encrypt_credentials(camera.password) if camera.password else None,
        enabled=camera.enabled,
        roi_x=camera.roi_x,
        roi_y=camera.roi_y,
        roi_width=camera.roi_width,
        roi_height=camera.roi_height,
        roi_polygon=camera.roi_polygon,
        detection_sensitivity=camera.detection_sensitivity,
    )
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)

    # Sync to WebRTC service if camera has RTSP URL and is enabled
    # Use rtsp_url if available, otherwise fall back to stream_url
    rtsp_url = db_camera.rtsp_url or db_camera.stream_url
    if rtsp_url and db_camera.enabled:
        webrtc_service.add_camera(
            str(db_camera.id),
            rtsp_url,
            camera.username,
            camera.password,
        )

    return db_camera


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.get("/{camera_id}/snapshot")
def get_camera_snapshot(camera_id: int, db: Session = Depends(get_db)):
    """Capture a single frame from the camera stream for ROI setup."""
    import av
    from app.core.security import decrypt_credentials

    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Use RTSP URL if available, otherwise fall back to stream_url
    rtsp_url = camera.rtsp_url or camera.stream_url

    # Build URL with credentials if needed
    if camera.username_encrypted and camera.password_encrypted:
        username = decrypt_credentials(camera.username_encrypted)
        password = decrypt_credentials(camera.password_encrypted)
        if rtsp_url.startswith('rtsp://'):
            rtsp_url = rtsp_url.replace('rtsp://', f'rtsp://{username}:{password}@')

    try:
        container = av.open(rtsp_url, format='rtsp', options={
            'rtsp_transport': 'tcp',
            'threads': '1',
            'ffmpeg_global_options': '-threads 1',
        })
        stream = container.streams.video[0]

        for packet in container.demux(stream):
            for frame in packet.decode():
                if frame:
                    img = frame.to_image()
                    container.close()
                    # Convert to base64
                    buffered = io.BytesIO()
                    img.save(buffered, format="JPEG", quality=85)
                    img_bytes = buffered.getvalue()
                    return {"image": base64.b64encode(img_bytes).decode('utf-8')}
        container.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to capture snapshot: {str(e)}")

    raise HTTPException(status_code=500, detail="Failed to capture snapshot")


@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera(camera_id: int, camera: CameraUpdate, db: Session = Depends(get_db)):
    db_camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not db_camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    update_data = camera.model_dump(exclude_unset=True)
    if "username" in update_data and update_data["username"]:
        update_data["username_encrypted"] = encrypt_credentials(update_data.pop("username"))
    if "password" in update_data and update_data["password"]:
        update_data["password_encrypted"] = encrypt_credentials(update_data.pop("password"))

    for key, value in update_data.items():
        if key not in ("username", "password"):
            setattr(db_camera, key, value)

    db.commit()
    db.refresh(db_camera)

    # Sync ROI changes to detection service
    detection_service.update_camera(camera_id)

    # Sync to WebRTC service on RTSP URL or enabled changes
    # Use rtsp_url if available, otherwise fall back to stream_url
    rtsp_url = update_data.get("rtsp_url") or db_camera.rtsp_url or db_camera.stream_url
    enabled = update_data.get("enabled", db_camera.enabled)

    if enabled and rtsp_url:
        # Get decrypted credentials for webrtc service
        username = None
        password = None
        if "username" in update_data:
            username = update_data["username"]
        elif db_camera.username_encrypted:
            username = decrypt_credentials(db_camera.username_encrypted)
        if "password" in update_data:
            password = update_data["password"]
        elif db_camera.password_encrypted:
            password = decrypt_credentials(db_camera.password_encrypted)

        # Remove old and add new if RTSP URL changed
        webrtc_service.remove_camera(str(camera_id))
        webrtc_service.add_camera(str(camera_id), rtsp_url, username, password)
    elif not enabled:
        webrtc_service.remove_camera(str(camera_id))

    return db_camera


@router.delete("/{camera_id}")
def delete_camera(camera_id: int, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Remove from WebRTC service
    webrtc_service.remove_camera(str(camera_id))

    db.delete(camera)
    db.commit()
    return {"message": "Camera deleted"}
