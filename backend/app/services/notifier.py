"""
Notification provider system for detection alerts.
"""
from abc import ABC, abstractmethod
from typing import Optional

from app.services.telegram import telegram_notifier


class NotificationProvider(ABC):
    """Abstract base class for notification providers."""

    @abstractmethod
    async def send(
        self,
        camera_name: str,
        detection_type: str,
        confidence: float,
        description: Optional[str] = None,
        snapshot_path: Optional[str] = None,
    ) -> bool:
        """Send a notification for a detection."""
        pass


class TelegramNotificationProvider(NotificationProvider):
    """Telegram notification provider."""

    async def send(
        self,
        camera_name: str,
        detection_type: str,
        confidence: float,
        description: Optional[str] = None,
        snapshot_path: Optional[str] = None,
    ) -> bool:
        message = (
            f"Detection Alert\n\n"
            f"Camera: {camera_name}\n"
            f"Type: {detection_type}\n"
            f"Confidence: {confidence:.1%}"
        )
        if description:
            message += f"\n\nDescription: {description}"

        if snapshot_path:
            return await telegram_notifier.send_photo(snapshot_path, message)
        return await telegram_notifier.send_message(message)


class NotificationManager:
    """Manages notification providers and sends notifications."""

    def __init__(self):
        self._providers: list[NotificationProvider] = []
        self._setup_default_providers()

    def _setup_default_providers(self):
        """Set up default notification providers."""
        self._providers.append(TelegramNotificationProvider())

    def add_provider(self, provider: NotificationProvider):
        """Add a notification provider."""
        self._providers.append(provider)

    async def notify(
        self,
        camera_name: str,
        detection_type: str,
        confidence: float,
        description: Optional[str] = None,
        snapshot_path: Optional[str] = None,
    ) -> bool:
        """Send notification through all providers. Returns True if any provider succeeds."""
        import logging
        logger = logging.getLogger(__name__)

        results = []
        for provider in self._providers:
            try:
                result = await provider.send(
                    camera_name, detection_type, confidence, description, snapshot_path
                )
                results.append(result)
                if not result:
                    logger.warning(f"Notification provider {type(provider).__name__} returned False")
            except Exception as e:
                logger.error(f"Notification provider {type(provider).__name__} failed: {e}")
                results.append(False)
        return any(results)


notification_manager = NotificationManager()
