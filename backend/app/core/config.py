from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Eyes"
    VERSION: str = "3.0.0"

    DATABASE_URL: str = f"sqlite:///{BASE_DIR.parent}/data/smart_eyes.db"

    ENCRYPTION_KEY: str = ""  # Set via environment variable

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    GO2RTC_HOST: str = "localhost"
    GO2RTC_PORT: int = 1984

    AI_MODEL_PATH: str = "yolov8n.pt"
    MOONDREAM_MODEL_PATH: str = "moondream model path"

    SNAPSHOT_DIR: Path = BASE_DIR.parent / "data" / "snapshots"
    MAX_SNAPSHOTS: int = 500
    BATCH_CLEANUP_PERCENT: float = 0.10

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
