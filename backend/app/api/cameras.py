from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.models.database import Camera, get_db
from app.core.security import encrypt_credentials, decrypt_credentials

router = APIRouter(prefix="/cameras", tags=["cameras"])


class CameraCreate(BaseModel):
    name: str
    stream_url: str
    rtsp_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    enabled: bool = True
    roi_x: int = 0
    roi_y: int = 0
    roi_width: int = 0
    roi_height: int = 0
    detection_sensitivity: float = 0.5


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    stream_url: Optional[str] = None
    rtsp_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    enabled: Optional[bool] = None
    roi_x: Optional[int] = None
    roi_y: Optional[int] = None
    roi_width: Optional[int] = None
    roi_height: Optional[int] = None
    detection_sensitivity: Optional[float] = None


class CameraResponse(BaseModel):
    id: int
    name: str
    stream_url: str
    rtsp_url: Optional[str]
    enabled: bool
    roi_x: int
    roi_y: int
    roi_width: int
    roi_height: int
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
        detection_sensitivity=camera.detection_sensitivity,
    )
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)
    return db_camera


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


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
    return db_camera


@router.delete("/{camera_id}")
def delete_camera(camera_id: int, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    db.delete(camera)
    db.commit()
    return {"message": "Camera deleted"}
