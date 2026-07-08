from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.modules.auth import service
from app.modules.auth.schemas import LoginRequest, RefreshRequest, TokenPair, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, db: DbSession):
    access, refresh = service.login(db, body.email, body.password)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: DbSession):
    access, refresh_token = service.refresh(db, body.refresh_token)
    return TokenPair(access_token=access, refresh_token=refresh_token)


@router.post("/logout")
def logout(_: CurrentUser):
    # Токены stateless; клиент удаляет их у себя. Blacklist — при необходимости позже.
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
