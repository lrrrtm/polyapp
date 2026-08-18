from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    schedule_changes_enabled: bool
    lesson_added_enabled: bool
    lesson_removed_enabled: bool
    time_changed_enabled: bool
    auditorium_changed_enabled: bool
    teacher_changed_enabled: bool


class NotificationSettingsUpdate(BaseModel):
    schedule_changes_enabled: bool
    lesson_added_enabled: bool
    lesson_removed_enabled: bool
    time_changed_enabled: bool
    auditorium_changed_enabled: bool
    teacher_changed_enabled: bool


class TelegramAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    telegram_user_id: int
    telegram_chat_id: int
    telegram_username: str | None
    is_active: bool
    linked_at: datetime


class TelegramStatusRead(BaseModel):
    connected: bool
    account: TelegramAccountRead | None
    settings: NotificationSettingsRead


class TelegramLinkRead(BaseModel):
    token: str
    url: str
    expires_at: datetime
