import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class EncryptionManager:
    """AES-256-GCM encryption for credential storage."""

    def __init__(self, master_password: str):
        self._salt = b"smart_eyes_salt_v1"  # In production, store salt securely
        self._key = self._derive_key(master_password)
        self._aesgcm = AESGCM(self._key)

    def _derive_key(self, password: str) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self._salt,
            iterations=480000,
        )
        return kdf.derive(password.encode())

    def encrypt(self, plaintext: str) -> str:
        nonce = os.urandom(12)
        ciphertext = self._aesgcm.encrypt(nonce, plaintext.encode(), None)
        return base64.b64encode(nonce + ciphertext).decode()

    def decrypt(self, encrypted: str) -> str:
        data = base64.b64decode(encrypted.encode())
        nonce, ciphertext = data[:12], data[12:]
        return self._aesgcm.decrypt(nonce, ciphertext, None).decode()


_encryption_manager: EncryptionManager | None = None


def get_encryption_manager() -> EncryptionManager:
    global _encryption_manager
    if _encryption_manager is None:
        from app.core.config import settings
        if not settings.ENCRYPTION_KEY:
            raise ValueError("ENCRYPTION_KEY not set in settings")
        _encryption_manager = EncryptionManager(settings.ENCRYPTION_KEY)
    return _encryption_manager


def encrypt_credentials(plaintext: str) -> str:
    return get_encryption_manager().encrypt(plaintext)


def decrypt_credentials(encrypted: str) -> str:
    return get_encryption_manager().decrypt(encrypted)
