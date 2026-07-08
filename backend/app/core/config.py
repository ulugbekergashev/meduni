from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    secret_key: str = "dev-secret-not-for-production-0123456789abcdef"
    access_token_minutes: int = 30
    refresh_token_days: int = 7

    ai_text_provider: str = "gemini"
    ai_image_provider: str = "gemini"
    ai_tts_provider: str = "edge"
    gemini_api_key: str = ""
    gemini_text_model: str = "gemini-2.5-flash"
    gemini_image_model: str = "gemini-2.5-flash-image"

    storage_dir: str = "./storage"
    jobs_sync: bool = False  # тесты: выполнять задачи синхронно
    max_material_chars: int = 60_000  # обрезка текста материала для LLM


settings = Settings()
