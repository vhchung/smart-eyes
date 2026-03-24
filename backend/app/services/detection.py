"""
AI Person Detection Service using YOLOv8n and Moondream2.
"""
import asyncio
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import av
import torch
from PIL import Image
from ultralytics import YOLO

from app.core.config import settings
from app.core.security import decrypt_credentials
from app.models.database import Camera, DetectionLog, SessionLocal
from app.services.notifier import notification_manager

logger = logging.getLogger(__name__)


@dataclass
class PersonDetection:
    """Represents a detected person."""
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float


@dataclass
class DetectionResult:
    """Result from the detection pipeline."""
    camera_id: int
    camera_name: str
    persons: list[PersonDetection]
    descriptions: list[str]
    snapshot_path: Optional[str] = None


class FrameSampler:
    """Samples frames from RTSP streams at configurable intervals."""

    def __init__(self, rtsp_url: str, username: Optional[str] = None, password: Optional[str] = None):
        self.rtsp_url = rtsp_url
        self.username = username
        self.password = password
        self._container: Optional[av.container.InputContainer] = None
        self._stream: Optional[av.stream.Stream] = None

    def _build_url(self) -> str:
        """Build RTSP URL with credentials if provided."""
        if self.username and self.password and self.rtsp_url.startswith('rtsp://'):
            return self.rtsp_url.replace(
                'rtsp://',
                f'rtsp://{self.username}:{self.password}@'
            )
        return self.rtsp_url

    def _open_stream(self):
        """Open the RTSP stream."""
        stream_url = self._build_url()
        self._container = av.open(stream_url, format='rtsp', options={
            'rtsp_transport': 'tcp',
            'threads': '2',
            'ffmpeg_global_options': '-threads 2',
        })
        self._stream = self._container.streams.video[0]

    def _close_stream(self):
        """Close the RTSP stream."""
        if self._container:
            self._container.close()
            self._container = None
            self._stream = None

    def get_frame(self, roi: Optional[tuple[int, int, int, int]] = None) -> Optional[Image.Image]:
        """
        Get a single frame from the stream, optionally applying ROI.
        Returns PIL Image or None if failed.
        """
        try:
            self._open_stream()
            for packet in self._container.demux(self._stream):
                for frame in packet.decode():
                    if frame:
                        img = frame.to_image()
                        self._close_stream()
                        if roi:
                            x, y, w, h = roi
                            img = img.crop((x, y, x + w, y + h))
                        return img
        except Exception as e:
            logger.error(f"Error getting frame: {e}")
        finally:
            self._close_stream()
        return None


class PersonDetector:
    """Detects persons in frames using YOLOv8n."""

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.AI_MODEL_PATH
        self._model: Optional[YOLO] = None

    def _load_model(self):
        """Load YOLO model (lazy loading)."""
        if self._model is None:
            logger.info(f"Loading YOLOv8n model from {self.model_path}")
            self._model = YOLO(self.model_path)

    def detect(self, image: Image.Image, min_confidence: float = 0.5) -> list[PersonDetection]:
        """Detect persons in the image."""
        self._load_model()
        results = self._model(image, verbose=False)
        persons = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                if cls == 0 and conf >= min_confidence:  # person class
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    persons.append(PersonDetection(
                        bbox=(x1, y1, x2, y2),
                        confidence=conf
                    ))
        return persons


class ActionDescriber:
    """Describes person actions using BLIP image captioning."""

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.CAPTION_MODEL_PATH
        self._model = None
        self._processor = None
        self._device = "cuda" if torch.cuda.is_available() else "cpu"

    def _load_model(self):
        """Load BLIP captioning model (lazy loading)."""
        if self._model is None:
            logger.info(f"Loading BLIP captioning model from {self.model_path}")
            from transformers import BlipForConditionalGeneration, AutoProcessor
            self._processor = AutoProcessor.from_pretrained(self.model_path)
            self._model = BlipForConditionalGeneration.from_pretrained(self.model_path)
            self._model.to(self._device)

    def describe(self, image: Image.Image, bbox: tuple[int, int, int, int]) -> str:
        """Generate caption for a person in the given bbox."""
        self._load_model()
        try:
            cropped = image.crop(bbox)
            inputs = self._processor(images=cropped, return_tensors="pt").to(self._device)
            output = self._model.generate(**inputs, max_new_tokens=50)
            caption = self._processor.decode(output[0], skip_special_tokens=True)
            return caption.strip()
        except Exception as e:
            logger.error(f"Error describing action: {e}")
            return "Unknown action"


class DetectionService:
    """Main service that orchestrates person detection across all cameras."""

    def __init__(self):
        self._running = False
        self._tasks: dict[int, asyncio.Task] = {}
        self._last_notification_time: dict[int, float] = {}
        self._frame_sampler = FrameSampler
        self._person_detector = PersonDetector()
        self._action_describer = ActionDescriber()
        self._models_ready = False
        self._models_downloading = False
        self._init_error: Optional[str] = None

    @property
    def models_ready(self) -> bool:
        return self._models_ready

    @property
    def models_downloading(self) -> bool:
        return self._models_downloading

    @property
    def init_error(self) -> Optional[str]:
        return self._init_error

    def get_status(self) -> dict:
        """Get current status of the detection service."""
        return {
            "models_ready": self._models_ready,
            "models_downloading": self._models_downloading,
            "init_error": self._init_error,
            "running": self._running,
            "active_tasks": len(self._tasks),
        }

    async def ensure_models_downloaded(self):
        """Ensure AI models are downloaded before starting detection."""
        if self._models_ready or self._models_downloading:
            return

        self._models_downloading = True
        logger.info("Starting model download...")
        try:
            # YOLOv8 - ultralytics auto-downloads if not present
            yolo_path = settings.AI_MODEL_PATH
            if not yolo_path.endswith('.pt') or not Path(yolo_path).exists():
                yolo_path = "yolov8n.pt"
            logger.info(f"Ensuring YOLOv8n model is available...")
            self._person_detector._load_model()
            logger.info(f"YOLOv8n model loaded")

            # Caption model - HuggingFace auto-downloads
            logger.info(f"Ensuring caption model is available...")
            self._action_describer._load_model()
            logger.info(f"Caption model loaded")

            self._models_ready = True
            self._init_error = None
            logger.info("All AI models ready")
        except Exception as e:
            self._init_error = str(e)
            logger.error(f"Failed to download models: {e}")
        finally:
            self._models_downloading = False

    async def start(self):
        """Start detection service and all camera detection loops."""
        if self._running:
            return

        # Download models first
        await self.ensure_models_downloaded()
        if not self._models_ready:
            logger.warning("Detection service starting without models - will retry later")

        self._running = True
        logger.info("Starting DetectionService")

        db = SessionLocal()
        try:
            cameras = db.query(Camera).filter(Camera.enabled == True).all()
            for camera in cameras:
                rtsp_url = camera.rtsp_url or camera.stream_url
                if rtsp_url:
                    username = decrypt_credentials(camera.username_encrypted) if camera.username_encrypted else None
                    password = decrypt_credentials(camera.password_encrypted) if camera.password_encrypted else None
                    self._tasks[camera.id] = asyncio.create_task(
                        self._detection_loop(camera, rtsp_url, username, password)
                    )
                    logger.info(f"Started detection loop for camera {camera.id}")
        finally:
            db.close()

    async def stop(self):
        """Stop detection service and all camera detection loops."""
        self._running = False
        logger.info("Stopping DetectionService")
        for task in self._tasks.values():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self._tasks.clear()

    async def _detection_loop(
        self,
        camera: Camera,
        rtsp_url: str,
        username: Optional[str],
        password: Optional[str],
    ):
        """Detection loop for a single camera."""
        sampler = self._frame_sampler(rtsp_url, username, password)
        roi = None
        if camera.roi_width > 0 and camera.roi_height > 0:
            roi = (camera.roi_x, camera.roi_y, camera.roi_width, camera.roi_height)

        min_confidence = camera.detection_sensitivity or settings.DETECTION_MIN_CONFIDENCE

        while self._running:
            try:
                frame = await asyncio.get_event_loop().run_in_executor(
                    None, sampler.get_frame, roi
                )
                if frame is None:
                    await asyncio.sleep(settings.DETECTION_INTERVAL)
                    continue

                persons = self._person_detector.detect(frame, min_confidence)
                if persons:
                    descriptions = []
                    for person in persons:
                        desc = self._action_describer.describe(frame, person.bbox)
                        descriptions.append(desc)

                    snapshot_path = await self._save_snapshot(frame, camera.id)

                    await self._handle_detection(
                        camera=camera,
                        persons=persons,
                        descriptions=descriptions,
                        snapshot_path=snapshot_path,
                    )

                await asyncio.sleep(settings.DETECTION_INTERVAL)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in detection loop for camera {camera.id}: {e}")
                await asyncio.sleep(settings.DETECTION_INTERVAL)

    async def _handle_detection(
        self,
        camera: Camera,
        persons: list[PersonDetection],
        descriptions: list[str],
        snapshot_path: Optional[str],
    ):
        """Handle a detection event - save to DB and send notifications."""
        current_time = time.time()
        last_time = self._last_notification_time.get(camera.id, 0)

        if current_time - last_time < settings.DETECTION_COOLDOWN:
            logger.debug(f"Skipping notification for camera {camera.id} - cooldown active")
            return

        self._last_notification_time[camera.id] = current_time

        best_person = max(persons, key=lambda p: p.confidence)
        best_desc = descriptions[0] if descriptions else None

        db = SessionLocal()
        try:
            log = DetectionLog(
                camera_id=camera.id,
                detection_type="person",
                confidence=best_person.confidence,
                snapshot_path=snapshot_path,
                description=best_desc,
            )
            db.add(log)
            db.commit()
            logger.info(f"Saved detection log for camera {camera.id}: {best_person.confidence:.2f} confidence")
        finally:
            db.close()

        await notification_manager.notify(
            camera_name=camera.name,
            detection_type="person",
            confidence=best_person.confidence,
            description=best_desc,
            snapshot_path=snapshot_path,
        )

    async def _save_snapshot(self, image: Image.Image, camera_id: int) -> Optional[str]:
        """Save a snapshot image."""
        try:
            settings.SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
            filename = f"detection_{camera_id}_{int(time.time())}.jpg"
            path = settings.SNAPSHOT_DIR / filename
            image.save(path, "JPEG", quality=85)
            return str(path)
        except Exception as e:
            logger.error(f"Error saving snapshot: {e}")
            return None


detection_service = DetectionService()
