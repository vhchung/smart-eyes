from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.models.database import DetectionLog, get_db

router = APIRouter(prefix="/detections", tags=["detections"])


class DetectionLogResponse(BaseModel):
    id: int
    camera_id: int
    detection_type: str
    confidence: float
    snapshot_path: Optional[str]
    description: Optional[str]
    detected_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[DetectionLogResponse])
def list_detections(
    camera_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(DetectionLog)
    if camera_id:
        query = query.filter(DetectionLog.camera_id == camera_id)
    return query.order_by(DetectionLog.detected_at.desc()).limit(limit).all()


@router.get("/{detection_id}", response_model=DetectionLogResponse)
def get_detection(detection_id: int, db: Session = Depends(get_db)):
    detection = db.query(DetectionLog).filter(DetectionLog.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    return detection


@router.delete("/{detection_id}")
def delete_detection(detection_id: int, db: Session = Depends(get_db)):
    detection = db.query(DetectionLog).filter(DetectionLog.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    db.delete(detection)
    db.commit()
    return {"message": "Detection deleted"}


@router.delete("")
def delete_all_detections(db: Session = Depends(get_db)):
    db.query(DetectionLog).delete()
    db.commit()
    return {"message": "All detections deleted"}
