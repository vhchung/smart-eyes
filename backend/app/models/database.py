from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    stream_url = Column(Text, nullable=False)
    rtsp_url = Column(Text, nullable=True)
    username_encrypted = Column(Text, nullable=True)
    password_encrypted = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True)
    detection_enabled = Column(Boolean, default=True)
    notification_enabled = Column(Boolean, default=True)
    roi_x = Column(Integer, default=0)
    roi_y = Column(Integer, default=0)
    roi_width = Column(Integer, default=0)
    roi_height = Column(Integer, default=0)
    detection_sensitivity = Column(Float, default=0.5)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DetectionLog(Base):
    __tablename__ = "detection_logs"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, nullable=False)
    detection_type = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    snapshot_path = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow)


class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, nullable=False)
    file_path = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SettingsModel(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=False)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
