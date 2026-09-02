from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.main import app
from app.notifications.models import NotificationOutbox, TelegramAccount
from app.notifications.service import (
    claim_due_notifications,
    create_telegram_link_token,
    deactivate_telegram_chat,
    link_telegram_account,
    mark_notification_failed,
    mark_notification_sent,
    update_notification_settings,
)
from app.bot.main import send_telegram_notification
from app.notifications.schemas import NotificationSettingsUpdate
from app.schemas.ruz import Auditorium, Building, Group, GroupSchedule, Lesson, LessonType, Teacher, Week
from app.schedules.service import save_group_schedule_cache
from app.services.models import FeedbackRequest
from app.users.deps import hash_identity_token
from app.users.models import User, UserScheduleItem


def make_schedule(
    *,
    subject: str = "Связь",
    time_start: datetime = datetime(2026, 9, 2, 7, 0, tzinfo=UTC),
    auditorium_name: str = "101",
    teacher_name: str = "Иванов Иван Иванович",
) -> GroupSchedule:
    return GroupSchedule(
        week=Week(date_start="2026.08.31", date_end="2026.09.06", is_odd=True),
        group=Group(id=44302, name="4931102/40101"),
        days=[
            {
                "weekday": 3,
                "date": "2026.09.02",
                "lessons": [
                    Lesson(
                        subject=subject,
                        time_start=time_start,
                        time_end=datetime(2026, 9, 2, 8, 30, tzinfo=UTC),
                        typeObj=LessonType(name="Практика"),
                        auditories=[
                            Auditorium(id=1, name=auditorium_name, building=Building(id=11, name="Главное здание"))
                        ],
                        teachers=[Teacher(id=1, full_name=teacher_name)],
                    )
                ],
            }
        ],
    )


async def create_user_with_telegram(
    db: AsyncSession,
    *,
    notifications_enabled: bool = True,
    item_notifications_enabled: bool = True,
) -> User:
    user = User(identity_hash="telegram-user")
    db.add(user)
    await db.flush()
    db.add(
        UserScheduleItem(
            user_id=user.id,
            item_type="group",
            ruz_id=44302,
            is_primary=True,
            notifications_enabled=item_notifications_enabled,
        )
    )
    db.add(TelegramAccount(user_id=user.id, telegram_user_id=1001, telegram_chat_id=2002, is_active=True))
    await update_notification_settings(
        db,
        user.id,
        NotificationSettingsUpdate(
            schedule_changes_enabled=notifications_enabled,
            lesson_added_enabled=True,
            lesson_removed_enabled=True,
            time_changed_enabled=True,
            auditorium_changed_enabled=True,
            teacher_changed_enabled=True,
        ),
    )
    await db.flush()
    return user


@pytest.mark.asyncio
async def test_telegram_status_and_settings_api(override_db: None) -> None:
    settings = get_settings()
    old_username = settings.telegram_bot_username
    settings.telegram_bot_username = "polytech_bot"
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/me")
            status = await client.get("/api/v1/me/telegram")
            link = await client.post("/api/v1/me/telegram/link-token")
            updated = await client.put(
                "/api/v1/me/notification-settings",
                json={
                    "schedule_changes_enabled": True,
                    "lesson_added_enabled": True,
                    "lesson_removed_enabled": False,
                    "time_changed_enabled": True,
                    "auditorium_changed_enabled": True,
                    "teacher_changed_enabled": False,
                },
            )
    finally:
        settings.telegram_bot_username = old_username

    assert status.status_code == 200
    assert status.json()["connected"] is False
    assert status.json()["settings"]["schedule_changes_enabled"] is False
    assert link.status_code == 200
    assert link.json()["url"].startswith("https://t.me/polytech_bot?start=")
    assert updated.status_code == 200
    assert updated.json()["lesson_removed_enabled"] is False


@pytest.mark.asyncio
async def test_link_token_is_single_use(override_db: None, db_session: AsyncSession) -> None:
    user = User(identity_hash=hash_identity_token("token-user"))
    db_session.add(user)
    await db_session.flush()
    token = await create_telegram_link_token(db_session, user.id)
    account = await link_telegram_account(
        db_session,
        token.token,
        telegram_user_id=1001,
        telegram_chat_id=2002,
        telegram_username="student",
    )
    reused = await link_telegram_account(
        db_session,
        token.token,
        telegram_user_id=1001,
        telegram_chat_id=2002,
        telegram_username="student",
    )

    assert account is not None
    assert account.user_id == user.id
    assert reused is None


@pytest.mark.asyncio
async def test_expired_link_token_is_rejected(override_db: None, db_session: AsyncSession) -> None:
    user = User(identity_hash="expired-token-user")
    db_session.add(user)
    await db_session.flush()
    token = await create_telegram_link_token(db_session, user.id)
    token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.flush()

    account = await link_telegram_account(
        db_session,
        token.token,
        telegram_user_id=1001,
        telegram_chat_id=2002,
        telegram_username=None,
    )

    assert account is None


@pytest.mark.asyncio
async def test_schedule_change_creates_outbox_by_enabled_settings(override_db: None, db_session: AsyncSession) -> None:
    await create_user_with_telegram(db_session, notifications_enabled=True)
    await save_group_schedule_cache(db_session, make_schedule(auditorium_name="101"))
    await save_group_schedule_cache(db_session, make_schedule(auditorium_name="102"))

    outbox = list(await db_session.scalars(select(NotificationOutbox)))

    assert len(outbox) == 1
    assert outbox[0].event_type == "auditorium_changed"
    assert "Изменилась аудитория" in outbox[0].text
    assert "4931102/40101" in outbox[0].text
    assert "Практика" in outbox[0].text
    assert "07:00–08:30" in outbox[0].text
    assert "2026-09-02T07:00:00" not in outbox[0].text


@pytest.mark.asyncio
async def test_schedule_change_respects_disabled_settings(override_db: None, db_session: AsyncSession) -> None:
    await create_user_with_telegram(db_session, notifications_enabled=False)
    await save_group_schedule_cache(db_session, make_schedule(auditorium_name="101"))
    await save_group_schedule_cache(db_session, make_schedule(auditorium_name="102"))

    assert list(await db_session.scalars(select(NotificationOutbox))) == []


@pytest.mark.asyncio
async def test_schedule_change_respects_disabled_schedule_item(override_db: None, db_session: AsyncSession) -> None:
    await create_user_with_telegram(db_session, notifications_enabled=True, item_notifications_enabled=False)
    await save_group_schedule_cache(db_session, make_schedule(auditorium_name="101"))
    await save_group_schedule_cache(db_session, make_schedule(auditorium_name="102"))

    assert list(await db_session.scalars(select(NotificationOutbox))) == []


@pytest.mark.asyncio
async def test_schedule_change_event_types_enqueue_outbox(override_db: None, db_session: AsyncSession) -> None:
    await create_user_with_telegram(db_session, notifications_enabled=True)
    await save_group_schedule_cache(db_session, make_schedule(subject="Старая пара"))
    await save_group_schedule_cache(db_session, make_schedule(subject="Новая пара"))
    await save_group_schedule_cache(db_session, make_schedule(subject="Новая пара", time_start=datetime(2026, 9, 2, 9, 0, tzinfo=UTC)))
    await save_group_schedule_cache(db_session, make_schedule(subject="Новая пара", time_start=datetime(2026, 9, 2, 9, 0, tzinfo=UTC), teacher_name="Петров Пётр Петрович"))

    outbox = list(await db_session.scalars(select(NotificationOutbox)))
    event_types = [row.event_type for row in outbox]
    combined_message = next(row.text for row in outbox if row.event_type == "schedule_changes")

    assert "schedule_changes" in event_types
    assert "time_changed" in event_types
    assert "teacher_changed" in event_types
    assert "Занятие отменено" in combined_message
    assert "Занятие добавлено" in combined_message


@pytest.mark.asyncio
async def test_sender_state_transitions(override_db: None, db_session: AsyncSession) -> None:
    user = User(identity_hash="sender-user")
    db_session.add(user)
    await db_session.flush()
    notification = NotificationOutbox(
        user_id=user.id,
        channel="telegram",
        telegram_chat_id=2002,
        event_type="lesson_added",
        payload={},
        text="hello",
        dedupe_key="telegram:test:sender",
        next_attempt_at=datetime.now(UTC),
    )
    db_session.add(notification)
    await db_session.flush()

    claimed = await claim_due_notifications(db_session, 10)
    await mark_notification_failed(db_session, claimed[0], "retry", retry_after_seconds=42)
    await mark_notification_sent(db_session, claimed[0])

    assert claimed[0].status == "sent"
    assert claimed[0].attempts == 1
    assert claimed[0].sent_at is not None


@pytest.mark.asyncio
async def test_feedback_notification_sends_attachment(override_db: None, db_session: AsyncSession) -> None:
    user = User(identity_hash="feedback-sender-user")
    db_session.add(user)
    await db_session.flush()
    feedback = FeedbackRequest(
        user_id=user.id,
        subject="bug",
        message="Сломалось",
        contact="@student",
        attachment_filename="screen.png",
        attachment_content_type="image/png",
        attachment_size=5,
        attachment_data=b"hello",
        created_at=datetime.now(UTC),
    )
    db_session.add(feedback)
    await db_session.flush()
    notification = NotificationOutbox(
        user_id=user.id,
        channel="telegram",
        telegram_chat_id=2002,
        event_type="feedback_created",
        payload={"feedback_id": str(feedback.id)},
        text="feedback",
        dedupe_key="telegram:test:feedback-file",
        next_attempt_at=datetime.now(UTC),
    )
    db_session.add(notification)
    await db_session.flush()
    bot = FakeTelegramBot()

    await send_telegram_notification(bot, db_session, notification)

    assert bot.messages == [(2002, "feedback", "HTML")]
    assert len(bot.documents) == 1
    assert bot.documents[0][0] == 2002
    assert bot.documents[0][1].filename == "screen.png"
    assert bot.documents[0][1].data == b"hello"


@pytest.mark.asyncio
async def test_deactivate_telegram_chat_cancels_pending(override_db: None, db_session: AsyncSession) -> None:
    user = await create_user_with_telegram(db_session)
    db_session.add(
        NotificationOutbox(
            user_id=user.id,
            channel="telegram",
            telegram_chat_id=2002,
            event_type="lesson_added",
            payload={},
            text="hello",
            dedupe_key="telegram:test:cancel",
            next_attempt_at=datetime.now(UTC),
        )
    )
    await db_session.flush()

    await deactivate_telegram_chat(db_session, 2002)

    account = await db_session.scalar(select(TelegramAccount).where(TelegramAccount.user_id == user.id))
    notification = await db_session.scalar(select(NotificationOutbox).where(NotificationOutbox.dedupe_key == "telegram:test:cancel"))
    assert account is not None
    assert account.is_active is False
    assert notification is not None
    assert notification.status == "cancelled"


class FakeTelegramBot:
    def __init__(self) -> None:
        self.messages = []
        self.documents = []

    async def send_message(self, chat_id: int, text: str, parse_mode: str | None = None) -> None:
        self.messages.append((chat_id, text, parse_mode))

    async def send_document(self, chat_id: int, document) -> None:
        self.documents.append((chat_id, document))
