from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiError, ApiErrorCode, problem_responses
from app.core.config import get_settings
from app.db.session import get_db
from app.notifications.schemas import (
    NotificationSettingsRead,
    NotificationSettingsUpdate,
    TelegramAccountRead,
    TelegramLinkRead,
    TelegramStatusRead,
)
from app.notifications.service import (
    create_telegram_link_token,
    deactivate_telegram_account,
    get_notification_settings,
    get_telegram_account,
    update_notification_settings,
)
from app.users.deps import get_current_user
from app.users.models import User

router = APIRouter(tags=["notifications"])


@router.get("/me/telegram", response_model=TelegramStatusRead)
async def read_telegram_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TelegramStatusRead:
    account = await get_telegram_account(db, user.id)
    settings = await get_notification_settings(db, user.id)
    return TelegramStatusRead(
        connected=bool(account and account.is_active),
        account=TelegramAccountRead.model_validate(account) if account else None,
        settings=NotificationSettingsRead.model_validate(settings, from_attributes=True),
    )


@router.post("/me/telegram/link-token", response_model=TelegramLinkRead)
async def create_telegram_link(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TelegramLinkRead:
    settings = get_settings()
    if not settings.telegram_bot_username:
        raise ApiError(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code=ApiErrorCode.TELEGRAM_BOT_UNAVAILABLE,
            title="Telegram bot unavailable",
            message="Telegram-бот пока недоступен.",
        )

    link_token = await create_telegram_link_token(db, user.id)
    return TelegramLinkRead(
        token=link_token.token,
        url=f"https://t.me/{settings.telegram_bot_username}?start={link_token.token}",
        expires_at=link_token.expires_at,
    )


@router.delete("/me/telegram", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_telegram(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await deactivate_telegram_account(db, user.id)


@router.put(
    "/me/notification-settings",
    response_model=NotificationSettingsRead,
    responses=problem_responses(status.HTTP_404_NOT_FOUND),
)
async def update_settings(
    payload: NotificationSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationSettingsRead:
    settings = await update_notification_settings(db, user.id, payload)
    return NotificationSettingsRead.model_validate(settings, from_attributes=True)
