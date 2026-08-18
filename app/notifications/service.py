from __future__ import annotations

import secrets
from datetime import UTC, date, datetime, timedelta
from html import escape
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.notifications.models import (
    NotificationChannel,
    NotificationOutbox,
    NotificationStatus,
    TelegramAccount,
    TelegramLinkToken,
    UserNotificationSettings,
)
from app.notifications.schemas import NotificationSettingsUpdate
from app.schedules.models import ScheduleChangeEvent
from app.users.models import ScheduleItemType, User, UserScheduleItem

TOKEN_TTL = timedelta(minutes=15)
MAX_ATTEMPTS = 8
MONTH_NAMES = {
    1: "января",
    2: "февраля",
    3: "марта",
    4: "апреля",
    5: "мая",
    6: "июня",
    7: "июля",
    8: "августа",
    9: "сентября",
    10: "октября",
    11: "ноября",
    12: "декабря",
}


async def get_notification_settings(db: AsyncSession, user_id: UUID) -> UserNotificationSettings:
    settings = await db.get(UserNotificationSettings, user_id)
    if settings:
        return settings

    settings = UserNotificationSettings(user_id=user_id)
    db.add(settings)
    await db.flush()
    return settings


async def update_notification_settings(
    db: AsyncSession,
    user_id: UUID,
    payload: NotificationSettingsUpdate,
) -> UserNotificationSettings:
    settings = await get_notification_settings(db, user_id)
    for field, value in payload.model_dump().items():
        setattr(settings, field, value)
    settings.updated_at = datetime.now(UTC)
    await db.flush()
    return settings


async def get_telegram_account(db: AsyncSession, user_id: UUID) -> TelegramAccount | None:
    return await db.scalar(select(TelegramAccount).where(TelegramAccount.user_id == user_id))


async def create_telegram_link_token(db: AsyncSession, user_id: UUID) -> TelegramLinkToken:
    now = datetime.now(UTC)
    token = TelegramLinkToken(user_id=user_id, token=secrets.token_urlsafe(24), expires_at=now + TOKEN_TTL)
    db.add(token)
    await db.flush()
    return token


async def link_telegram_account(
    db: AsyncSession,
    token: str,
    *,
    telegram_user_id: int,
    telegram_chat_id: int,
    telegram_username: str | None,
) -> TelegramAccount | None:
    now = datetime.now(UTC)
    link_token = await db.scalar(
        select(TelegramLinkToken).where(
            TelegramLinkToken.token == token,
            TelegramLinkToken.used_at.is_(None),
            TelegramLinkToken.expires_at > now,
        )
    )
    if not link_token:
        return None

    account = await get_telegram_account(db, link_token.user_id)
    if account is None:
        account = await db.scalar(select(TelegramAccount).where(TelegramAccount.telegram_user_id == telegram_user_id))
    if account is None:
        account = TelegramAccount(
            user_id=link_token.user_id,
            telegram_user_id=telegram_user_id,
            telegram_chat_id=telegram_chat_id,
            telegram_username=telegram_username,
            is_active=True,
            linked_at=now,
            updated_at=now,
        )
        db.add(account)
    else:
        account.user_id = link_token.user_id
        account.telegram_user_id = telegram_user_id
        account.telegram_chat_id = telegram_chat_id
        account.telegram_username = telegram_username
        account.is_active = True
        account.updated_at = now

    link_token.used_at = now
    await get_notification_settings(db, link_token.user_id)
    await db.flush()
    return account


async def deactivate_telegram_account(db: AsyncSession, user_id: UUID) -> None:
    account = await get_telegram_account(db, user_id)
    if not account:
        return

    account.is_active = False
    account.updated_at = datetime.now(UTC)
    await cancel_pending_telegram_notifications(db, account.telegram_chat_id)
    await db.flush()


async def deactivate_telegram_chat(db: AsyncSession, chat_id: int) -> None:
    await db.execute(
        update(TelegramAccount)
        .where(TelegramAccount.telegram_chat_id == chat_id)
        .values(is_active=False, updated_at=datetime.now(UTC))
    )
    await cancel_pending_telegram_notifications(db, chat_id)
    await db.flush()


async def cancel_pending_telegram_notifications(db: AsyncSession, chat_id: int) -> None:
    await db.execute(
        update(NotificationOutbox)
        .where(
            NotificationOutbox.telegram_chat_id == chat_id,
            NotificationOutbox.channel == NotificationChannel.TELEGRAM.value,
            NotificationOutbox.status.in_(
                [NotificationStatus.PENDING.value, NotificationStatus.FAILED.value, NotificationStatus.PROCESSING.value]
            ),
        )
        .values(status=NotificationStatus.CANCELLED.value, updated_at=datetime.now(UTC))
    )


async def enqueue_schedule_change_notifications(
    db: AsyncSession,
    event: ScheduleChangeEvent,
    *,
    group_name: str,
) -> None:
    if event.item_type != ScheduleItemType.GROUP.value:
        return

    rows = await db.execute(
        select(UserScheduleItem.user_id, TelegramAccount.telegram_chat_id, UserNotificationSettings)
        .join(TelegramAccount, TelegramAccount.user_id == UserScheduleItem.user_id)
        .join(UserNotificationSettings, UserNotificationSettings.user_id == UserScheduleItem.user_id)
        .where(
            UserScheduleItem.item_type == ScheduleItemType.GROUP.value,
            UserScheduleItem.ruz_id == event.ruz_id,
            TelegramAccount.is_active.is_(True),
            UserNotificationSettings.schedule_changes_enabled.is_(True),
        )
    )

    now = datetime.now(UTC)
    for user_id, chat_id, settings in rows:
        for index, change in enumerate(event.changes):
            for bucket in notification_buckets(change):
                if not settings_allows_bucket(settings, bucket):
                    continue

                text = render_schedule_change_message(group_name, change, bucket)
                outbox = NotificationOutbox(
                    user_id=user_id,
                    channel=NotificationChannel.TELEGRAM.value,
                    telegram_chat_id=chat_id,
                    event_type=bucket,
                    source_event_id=event.id,
                    payload={"group_name": group_name, "change": change},
                    text=text,
                    dedupe_key=f"telegram:{user_id}:{event.id}:{index}:{bucket}",
                    next_attempt_at=now,
                    updated_at=now,
                )
                exists = await db.scalar(
                    select(NotificationOutbox.id).where(NotificationOutbox.dedupe_key == outbox.dedupe_key).limit(1)
                )
                if not exists:
                    db.add(outbox)

    await db.flush()


def notification_buckets(change: dict) -> list[str]:
    change_type = change.get("type")
    if change_type == "lesson_added":
        return ["lesson_added"]
    if change_type == "lesson_removed":
        return ["lesson_removed"]
    if change_type != "lesson_updated":
        return []

    fields = set(change.get("fields") or [])
    buckets = []
    if fields & {"time_start", "time_end", "date"}:
        buckets.append("time_changed")
    if "auditories" in fields:
        buckets.append("auditorium_changed")
    if "teachers" in fields:
        buckets.append("teacher_changed")
    return buckets


def settings_allows_bucket(settings: UserNotificationSettings, bucket: str) -> bool:
    return bool(getattr(settings, f"{bucket}_enabled", False))


def render_schedule_change_message(group_name: str, change: dict, bucket: str) -> str:
    lesson = change.get("lesson") or change.get("after") or change.get("before") or {}
    subject = lesson.get("subject") or "Занятие"
    when = format_lesson_time(lesson)
    title = {
        "lesson_added": "➕ Пара добавлена",
        "lesson_removed": "❌ Пара отменена",
        "time_changed": "⏰ Пара перенесена",
        "auditorium_changed": "📍 Изменилась аудитория",
        "teacher_changed": "👤 Изменился преподаватель",
    }[bucket]
    lines = [f"<b>{title}</b>", "", f"Группа {escape(group_name)}", escape(subject)]
    if when:
        lines.append(when)
    if bucket in {"time_changed", "auditorium_changed", "teacher_changed"}:
        before = change.get("before") or {}
        after = change.get("after") or {}
        lines.extend(["", f"<s>{escape(format_change_value(before, bucket))}</s>", f"→ {escape(format_change_value(after, bucket))}"])
    return "\n".join(lines)


def format_lesson_time(lesson: dict) -> str:
    date_value = str(lesson.get("date") or "").strip()
    start = str(lesson.get("time_start") or "").strip()
    end = str(lesson.get("time_end") or "").strip()
    time_range = f"{start}–{end}" if start and end else start or end
    return ", ".join(part for part in [format_date_value(date_value), time_range] if part)


def format_date_value(value: str) -> str:
    if not value:
        return ""

    try:
        parsed = date.fromisoformat(value.replace(".", "-"))
    except ValueError:
        return value

    return f"{parsed.day} {MONTH_NAMES[parsed.month]}"


def format_change_value(lesson: dict, bucket: str) -> str:
    if bucket == "time_changed":
        return format_lesson_time(lesson) or "не указано"
    if bucket == "auditorium_changed":
        return format_named_items(lesson.get("auditories") or [])
    if bucket == "teacher_changed":
        return format_named_items(lesson.get("teachers") or [])
    return "не указано"


def format_named_items(items: list[dict]) -> str:
    names = [str(item.get("name") or item.get("full_name") or "").strip() for item in items]
    names = [name for name in names if name]
    return ", ".join(names) if names else "не указано"


async def claim_due_notifications(db: AsyncSession, limit: int) -> list[NotificationOutbox]:
    now = datetime.now(UTC)
    result = await db.scalars(
        select(NotificationOutbox)
        .where(
            NotificationOutbox.channel == NotificationChannel.TELEGRAM.value,
            NotificationOutbox.status.in_(
                [NotificationStatus.PENDING.value, NotificationStatus.FAILED.value, NotificationStatus.PROCESSING.value]
            ),
            NotificationOutbox.next_attempt_at <= now,
            NotificationOutbox.attempts < MAX_ATTEMPTS,
        )
        .order_by(NotificationOutbox.created_at)
        .limit(limit)
    )
    notifications = list(result)
    for notification in notifications:
        notification.status = NotificationStatus.PROCESSING.value
        notification.next_attempt_at = now + timedelta(minutes=5)
        notification.updated_at = now
    await db.flush()
    return notifications


async def mark_notification_sent(db: AsyncSession, notification: NotificationOutbox) -> None:
    now = datetime.now(UTC)
    notification.status = NotificationStatus.SENT.value
    notification.sent_at = now
    notification.last_error = None
    notification.updated_at = now
    await db.flush()


async def mark_notification_failed(
    db: AsyncSession,
    notification: NotificationOutbox,
    error: str,
    *,
    retry_after_seconds: int | None = None,
) -> None:
    now = datetime.now(UTC)
    notification.attempts += 1
    notification.status = NotificationStatus.FAILED.value
    delay = retry_after_seconds if retry_after_seconds is not None else min(300, 2 ** notification.attempts)
    notification.next_attempt_at = now + timedelta(seconds=delay)
    notification.last_error = error[:1000]
    notification.updated_at = now
    if notification.attempts >= MAX_ATTEMPTS:
        notification.status = NotificationStatus.CANCELLED.value
    await db.flush()


async def mark_notification_cancelled(db: AsyncSession, notification: NotificationOutbox, error: str | None = None) -> None:
    notification.status = NotificationStatus.CANCELLED.value
    notification.last_error = error[:1000] if error else notification.last_error
    notification.updated_at = datetime.now(UTC)
    await db.flush()
