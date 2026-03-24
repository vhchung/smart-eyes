import aiohttp
from typing import Optional

from app.models.database import SettingsModel, get_db, SessionLocal
from app.core.security import decrypt_credentials


class TelegramNotifier:
    def __init__(self, bot_token: Optional[str] = None, chat_id: Optional[str] = None):
        self.bot_token = bot_token
        self.chat_id = chat_id

    def _get_credentials(self) -> tuple[Optional[str], Optional[str]]:
        """Fetch Telegram credentials from database."""
        db = SessionLocal()
        try:
            bot_token = None
            chat_id = None
            settings = db.query(SettingsModel).all()
            for s in settings:
                if s.key == "telegram_bot_token":
                    bot_token = decrypt_credentials(s.value) if s.value else None
                elif s.key == "telegram_chat_id":
                    chat_id = decrypt_credentials(s.value) if s.value else None
            return bot_token, chat_id
        finally:
            db.close()

    async def send_message(self, text: str) -> bool:
        bot_token, chat_id = self._get_credentials()
        if not bot_token or not chat_id:
            return False

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as resp:
                    return resp.status == 200
        except Exception:
            return False

    async def send_photo(self, photo_path: str, caption: str) -> bool:
        bot_token, chat_id = self._get_credentials()
        if not bot_token or not chat_id:
            return False

        url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
        form = aiohttp.FormData()
        form.add_field("chat_id", chat_id)
        form.add_field("caption", caption)
        form.add_field("parse_mode", "HTML")
        form.add_field("photo", open(photo_path, "rb"), filename="snapshot.jpg", content_type="image/jpeg")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=form) as resp:
                    return resp.status == 200
        except Exception:
            return False
        finally:
            form.remove_file("photo")

    async def send_detection_alert(
        self,
        camera_name: str,
        detection_type: str,
        confidence: float,
        snapshot_path: Optional[str] = None,
    ) -> bool:
        message = (
            f"🚨 <b>Detection Alert</b>\n\n"
            f"📹 Camera: {camera_name}\n"
            f"🔍 Type: {detection_type}\n"
            f"📊 Confidence: {confidence:.1%}"
        )

        if snapshot_path:
            return await self.send_photo(snapshot_path, message)
        return await self.send_message(message)


telegram_notifier = TelegramNotifier()


async def notify_detection(
    camera_name: str,
    detection_type: str,
    confidence: float,
    snapshot_path: Optional[str] = None,
) -> bool:
    return await telegram_notifier.send_detection_alert(
        camera_name, detection_type, confidence, snapshot_path
    )
