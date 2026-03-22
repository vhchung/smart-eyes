from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from pathlib import Path

from app.models.database import Snapshot, get_db
from app.core.config import settings

router = APIRouter(prefix="/snapshots", tags=["snapshots"])


class SnapshotResponse(BaseModel):
    id: int
    camera_id: int
    file_path: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[SnapshotResponse])
def list_snapshots(
    camera_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Snapshot)
    if camera_id:
        query = query.filter(Snapshot.camera_id == camera_id)
    return query.order_by(Snapshot.created_at.desc()).limit(limit).all()


@router.get("/{snapshot_id}")
def get_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    file_path = Path(snapshot.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Snapshot file not found")

    return FileResponse(file_path)


@router.delete("/{snapshot_id}")
def delete_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    file_path = Path(snapshot.file_path)
    if file_path.exists():
        file_path.unlink()

    db.delete(snapshot)
    db.commit()
    return {"message": "Snapshot deleted"}


@router.post("/cleanup")
def cleanup_snapshots(db: Session = Depends(get_db)):
    """Remove oldest snapshots exceeding MAX_SNAPSHOTS limit."""
    total_count = db.query(Snapshot).count()
    snapshots_to_delete = total_count - settings.MAX_SNAPSHOTS

    if snapshots_to_delete <= 0:
        return {"message": "No cleanup needed", "deleted": 0}

    oldest_snapshots = (
        db.query(Snapshot)
        .order_by(Snapshot.created_at.asc())
        .limit(snapshots_to_delete)
        .all()
    )

    deleted_count = 0
    for snapshot in oldest_snapshots:
        file_path = Path(snapshot.file_path)
        if file_path.exists():
            file_path.unlink()
        db.delete(snapshot)
        deleted_count += 1

    db.commit()
    return {"message": f"Cleaned up {deleted_count} snapshots", "deleted": deleted_count}
