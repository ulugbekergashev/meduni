"""Интерфейсы AI-провайдеров (план §5.4). Выбор — конфигурацией, не кодом."""
from abc import ABC, abstractmethod

from app.core.config import settings


class TextModel(ABC):
    @abstractmethod
    def generate_json(self, system: str, user: str, schema: dict) -> tuple[dict, int]:
        """Structured output по JSON-схеме. Возвращает (данные, потрачено токенов)."""


def get_text_model() -> TextModel:
    if settings.ai_text_provider == "gemini":
        from app.ai.providers.gemini import GeminiTextModel

        return GeminiTextModel()
    raise ValueError(f"Неизвестный текстовый AI-провайдер: {settings.ai_text_provider}")
