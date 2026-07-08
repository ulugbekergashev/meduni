from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.modules.auth.models import User

_invalid_credentials = ApiError(
    401, "invalid_credentials", "Email yoki parol notoʻgʻri", "Неверный email или пароль"
)


def login(db: Session, email: str, password: str) -> tuple[str, str]:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        raise _invalid_credentials
    return create_access_token(user.id), create_refresh_token(user.id)


def refresh(db: Session, refresh_token: str) -> tuple[str, str]:
    user_id = decode_token(refresh_token, "refresh")
    user = db.get(User, user_id) if user_id is not None else None
    if user is None or not user.is_active:
        raise ApiError(401, "invalid_token", "Token yaroqsiz", "Недействительный токен")
    return create_access_token(user.id), create_refresh_token(user.id)
