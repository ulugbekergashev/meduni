"""Интерфейсы AI-провайдеров (план §5.4). Выбор — конфигурацией, не кодом."""
from abc import ABC, abstractmethod

from app.core.config import settings


class TextModel(ABC):
    @abstractmethod
    def generate_json(self, system: str, user: str, schema: dict) -> tuple[dict, int]:
        """Structured output по JSON-схеме. Возвращает (данные, потрачено токенов)."""


class ImageModel(ABC):
    @abstractmethod
    def generate_image(self, prompt: str) -> bytes:
        """Генерирует изображение (PNG-байты) по текстовому промпту."""


class TTSModel(ABC):
    @abstractmethod
    def synthesize(self, text: str, voice: str) -> bytes:
        """Озвучивает текст, возвращает аудио (MP3-байты)."""


def get_text_model() -> TextModel:
    if settings.ai_text_provider == "gemini":
        from app.ai.providers.gemini import GeminiTextModel

        return GeminiTextModel()
    raise ValueError(f"Неизвестный текстовый AI-провайдер: {settings.ai_text_provider}")


def get_image_model() -> ImageModel:
    if settings.ai_image_provider == "gemini":
        from app.ai.providers.gemini import GeminiImageModel

        return GeminiImageModel()
    if settings.ai_image_provider == "pollinations":
        from app.ai.providers.pollinations import PollinationsImageModel

        return PollinationsImageModel()
    raise ValueError(f"Неизвестный image AI-провайдер: {settings.ai_image_provider}")


def get_tts_model() -> TTSModel:
    if settings.ai_tts_provider == "edge":
        from app.ai.providers.tts_edge import EdgeTTSModel

        return EdgeTTSModel()
    raise ValueError(f"Неизвестный TTS-провайдер: {settings.ai_tts_provider}")
