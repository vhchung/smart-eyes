import aiohttp
from typing import Optional

from app.core.config import settings


class TelegramNotifier:
    def __init__(self, bot_token: Optional[str] = None, chat_id: Optional[str] = None):
        self.bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN
        self.chat_id = chat_id or settings.TELEGRAM_CHAT_ID

    async def send_message(self, text: str) -> bool:
        if not self.bot_token or not self.chat_id:
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
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
        if not self.bot_token or not self.chat_id:
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendPhoto"
        form = aiohttp.FormData()
        form.add_field("chat_id", self.chat_id)
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
