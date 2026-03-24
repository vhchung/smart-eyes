"""
Status API endpoints for monitoring service health.
"""
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.detection import detection_service

router = APIRouter(prefix="/status", tags=["status"])


class DetectionStatusResponse(BaseModel):
    models_ready: bool
    models_downloading: bool
    init_error: Optional[str]
    running: bool
    active_tasks: int


@router.get("/detection", response_model=DetectionStatusResponse)
def get_detection_status():
    """
    Get the current status of the AI detection service.

    Returns:
    - models_ready: True if AI models are loaded and ready
    - models_downloading: True if models are currently being downloaded
    - init_error: Error message if model initialization failed
    - running: True if detection loops are active
    - active_tasks: Number of active camera detection tasks
    """
    return detection_service.get_status()
