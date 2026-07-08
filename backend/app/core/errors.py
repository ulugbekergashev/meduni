"""Единый формат ошибок API: {error: {code, message_uz, message_ru}} (план §10)."""
from fastapi import HTTPException


class ApiError(HTTPException):
    def __init__(self, status_code: int, code: str, message_uz: str, message_ru: str):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message_uz": message_uz, "message_ru": message_ru},
        )


def not_found(entity: str = "obyekt") -> ApiError:
    return ApiError(404, "not_found", f"{entity} topilmadi", "Не найдено")


def forbidden() -> ApiError:
    return ApiError(403, "forbidden", "Ruxsat yoʻq", "Нет доступа")
