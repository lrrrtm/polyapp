import hashlib
import secrets

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiError, ApiErrorCode
from app.core.config import get_settings
from app.db.session import get_db
from app.users.models import User
from app.users.service import create_user, get_user_by_identity_hash, touch_user


def hash_identity_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await get_optional_current_user(request, db)
    if user is None:
        raise ApiError(
            status_code=404,
            code=ApiErrorCode.USER_NOT_FOUND,
            title="User not found",
            message="Пользователь не найден.",
        )
    return user


async def get_optional_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    settings = get_settings()
    token = request.cookies.get(settings.user_cookie_name)

    if not token:
        return None

    user = await get_user_by_identity_hash(db, hash_identity_token(token))
    if user is None:
        return None

    await touch_user(user)
    return user


async def get_or_create_current_user(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await get_optional_current_user(request, db)
    if user is not None:
        return user

    settings = get_settings()
    token = secrets.token_urlsafe(32)
    user = await create_user(db, hash_identity_token(token))
    response.set_cookie(
        key=settings.user_cookie_name,
        value=token,
        max_age=settings.user_cookie_max_age,
        httponly=True,
        secure=settings.user_cookie_secure,
        samesite=settings.user_cookie_samesite,
        path="/",
    )
    return user
