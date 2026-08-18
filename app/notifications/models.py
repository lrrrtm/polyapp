from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.db.base import Base


class NotificationChannel(StrEnum):
    TELEGRAM = "telegram"


class NotificationStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TelegramAccount(Base):
    __tablename__ = "telegram_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_telegram_accounts_user_id"),
        UniqueConstraint("telegram_user_id", name="uq_telegram_accounts_telegram_user_id"),
        Index("ix_telegram_accounts_chat_id", "telegram_chat_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    telegram_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    telegram_chat_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    telegram_username: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TelegramLinkToken(Base):
    __tablename__ = "telegram_link_tokens"
    __table_args__ = (
        UniqueConstraint("token", name="uq_telegram_link_tokens_token"),
        Index("ix_telegram_link_tokens_user_id", "user_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class UserNotificationSettings(Base):
    __tablename__ = "user_notification_settings"

    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    schedule_changes_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    lesson_added_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    lesson_removed_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    time_changed_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    auditorium_changed_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    teacher_changed_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class NotificationOutbox(Base):
    __tablename__ = "notification_outbox"
    __table_args__ = (
        CheckConstraint("channel in ('telegram')", name="notification_channel_valid"),
        CheckConstraint("status in ('pending', 'processing', 'sent', 'failed', 'cancelled')", name="notification_status_valid"),
        UniqueConstraint("dedupe_key", name="uq_notification_outbox_dedupe_key"),
        Index("ix_notification_outbox_due", "status", "next_attempt_at"),
        Index("ix_notification_outbox_user_id", "user_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default=NotificationStatus.PENDING.value, server_default="pending")
    telegram_chat_id: Mapped[int | None] = mapped_column(BigInteger)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    source_event_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey("schedule_change_events.id", ondelete="CASCADE"))
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    dedupe_key: Mapped[str] = mapped_column(Text, nullable=False)
    attempts: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
