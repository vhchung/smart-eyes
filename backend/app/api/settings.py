from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.models.database import SettingsModel, get_db
from app.core.security import encrypt_credentials, decrypt_credentials

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    go2rtc_host: Optional[str] = None
    go2rtc_port: Optional[int] = None
    ai_model_path: Optional[str] = None
    moondream_model_path: Optional[str] = None
    max_snapshots: Optional[int] = None
    batch_cleanup_percent: Optional[float] = None


class SettingsResponse(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    go2rtc_host: str
    go2rtc_port: int
    ai_model_path: str
    moondream_model_path: str
    max_snapshots: int
    batch_cleanup_percent: float


@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    from app.core.config import settings

    settings_dict = {
        "telegram_bot_token": None,
        "telegram_chat_id": None,
        "go2rtc_host": settings.GO2RTC_HOST,
        "go2rtc_port": settings.GO2RTC_PORT,
        "ai_model_path": settings.AI_MODEL_PATH,
        "moondream_model_path": settings.MOONDREAM_MODEL_PATH,
        "max_snapshots": settings.MAX_SNAPSHOTS,
        "batch_cleanup_percent": settings.BATCH_CLEANUP_PERCENT,
    }

    db_settings = db.query(SettingsModel).all()
    for s in db_settings:
        if s.key == "telegram_bot_token":
            settings_dict["telegram_bot_token"] = decrypt_credentials(s.value) if s.value else None
        elif s.key == "telegram_chat_id":
            settings_dict["telegram_chat_id"] = decrypt_credentials(s.value) if s.value else None
        elif s.key == "go2rtc_host":
            settings_dict["go2rtc_host"] = s.value
        elif s.key == "go2rtc_port":
            settings_dict["go2rtc_port"] = int(s.value)
        elif s.key == "ai_model_path":
            settings_dict["ai_model_path"] = s.value
        elif s.key == "moondream_model_path":
            settings_dict["moondream_model_path"] = s.value
        elif s.key == "max_snapshots":
            settings_dict["max_snapshots"] = int(s.value)
        elif s.key == "batch_cleanup_percent":
            settings_dict["batch_cleanup_percent"] = float(s.value)

    return settings_dict


@router.put("")
def update_settings(settings_update: SettingsUpdate, db: Session = Depends(get_db)):
    update_data = settings_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if value is not None:
            encrypted_value = encrypt_credentials(value) if key in ("telegram_bot_token", "telegram_chat_id") else str(value)

            db_setting = db.query(SettingsModel).filter(SettingsModel.key == key).first()
            if db_setting:
                db_setting.value = encrypted_value
            else:
                db_setting = SettingsModel(key=key, value=encrypted_value)
                db.add(db_setting)

    db.commit()
    return {"message": "Settings updated"}
