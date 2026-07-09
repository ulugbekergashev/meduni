"""Динамический QR: TOTP-подобный токен, ротация каждые 15 секунд (план §8).
Скриншот однокурсника не сработает — токен живёт ~30 секунд (окно + допуск)."""
import hashlib
import hmac
import io
import time

import qrcode

WINDOW_SEC = 15
ALLOWED_SKEW = 1  # принимаем текущее и 1 предыдущее окно (~30 сек)


def _token_for_window(secret: str, window: int) -> str:
    mac = hmac.new(secret.encode(), str(window).encode(), hashlib.sha256)
    return mac.hexdigest()[:12]


def current_token(secret: str) -> str:
    return _token_for_window(secret, int(time.time()) // WINDOW_SEC)


def verify_token(secret: str, token: str) -> bool:
    window = int(time.time()) // WINDOW_SEC
    for delta in range(0, ALLOWED_SKEW + 1):
        if hmac.compare_digest(token, _token_for_window(secret, window - delta)):
            return True
    return False


def qr_png(payload: str) -> bytes:
    """QR-код PNG для payload (обычно session_id:token)."""
    qr = qrcode.QRCode(box_size=10, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0D9488", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
