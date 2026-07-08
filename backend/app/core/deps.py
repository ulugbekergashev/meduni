from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import ApiError, forbidden
from app.core.security import decode_token
from app.modules.auth.models import User

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    unauthorized = ApiError(401, "unauthorized", "Avtorizatsiya talab qilinadi", "Требуется авторизация")
    if creds is None:
        raise unauthorized
    user_id = decode_token(creds.credentials, "access")
    if user_id is None:
        raise unauthorized
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]


def require_roles(*roles: str):
    """RBAC-зависимость: пускает только пользователей с одной из ролей."""

    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise forbidden()
        return user

    return Depends(checker)
