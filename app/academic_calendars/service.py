from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.academic_calendars.group_mapping import AcademicCalendarKey, parse_group_academic_calendar_key
from app.academic_calendars.models import AcademicCalendar, AcademicCalendarDay, AcademicCalendarForm
from app.notifications.models import NotificationChannel, NotificationOutbox, TelegramAccount
from app.schedules.models import ScheduleCache
from app.users.models import ScheduleItemType, User, UserScheduleItem

PERIOD_LABELS = {
    "theory": "теоретическое обучение",
    "exam": "экзамены",
    "practice": "производственная практика",
    "diploma": "подготовка и защита диплома",
    "vacation": "каникулы",
    "pre_diploma_practice": "преддипломная практика",
    "holiday": "нерабочие праздничные дни",
}

PERIOD_START_TEXT = {
    "exam": "Начался период: экзамены",
    "vacation": "Начались каникулы",
    "practice": "Началась производственная практика",
}
NOTIFIABLE_PERIOD_TYPES = {"exam", "practice", "diploma", "vacation", "pre_diploma_practice"}
MOSCOW_TZ = ZoneInfo("Europe/Moscow")


@dataclass(frozen=True)
class AcademicPeriodRange:
    start_date: date
    end_date: date
    period_type: str


def moscow_today() -> date:
    return datetime.now(MOSCOW_TZ).date()


async def get_current_academic_calendar(
    db: AsyncSession,
    user: User,
    today: date | None = None,
) -> tuple[str, AcademicCalendar, list[AcademicCalendarDay], AcademicCalendarDay | None, list[AcademicPeriodRange]] | None:
    primary_group = await db.scalar(
        select(UserScheduleItem).where(
            UserScheduleItem.user_id == user.id,
            UserScheduleItem.item_type == ScheduleItemType.GROUP.value,
            UserScheduleItem.is_primary.is_(True),
        )
    )
    if not primary_group:
        return None

    group_name = await get_cached_group_name(db, primary_group.ruz_id)
    if not group_name:
        return None

    calendar = await get_calendar_for_group(db, group_name)
    if not calendar:
        return None

    today = today or moscow_today()
    current_periods = list(
        await db.scalars(
            select(AcademicCalendarDay)
            .where(AcademicCalendarDay.calendar_id == calendar.id, AcademicCalendarDay.date == today)
            .order_by(AcademicCalendarDay.period_type)
        )
    )
    periods = await list_calendar_period_ranges(db, calendar.id)
    current_types = {period.period_type for period in current_periods}
    next_period = next(
        (
            AcademicCalendarDay(calendar_id=calendar.id, date=period.start_date, period_type=period.period_type)
            for period in periods
            if period.start_date > today and period.period_type not in current_types
        ),
        None,
    )
    return group_name, calendar, current_periods, next_period, periods


async def get_calendar(db: AsyncSession, direction_code: str, level: int, admission_year: int) -> AcademicCalendar | None:
    return await db.scalar(
        select(AcademicCalendar).where(
            AcademicCalendar.direction_code == direction_code,
            AcademicCalendar.level == level,
            AcademicCalendar.admission_year == admission_year,
            AcademicCalendar.education_form == AcademicCalendarForm.FULL_TIME.value,
        )
    )


async def get_calendar_for_group(db: AsyncSession, group_name: str) -> AcademicCalendar | None:
    key = parse_group_academic_calendar_key(group_name)
    return await get_calendar_by_key(db, key) if key else None


async def get_calendar_by_key(db: AsyncSession, key: AcademicCalendarKey) -> AcademicCalendar | None:
    return await get_calendar(db, key.direction_code, key.level, key.admission_year)


async def get_cached_group_name(db: AsyncSession, group_id: int) -> str | None:
    cache = await db.scalar(
        select(ScheduleCache)
        .where(ScheduleCache.item_type == ScheduleItemType.GROUP.value, ScheduleCache.ruz_id == group_id)
        .order_by(ScheduleCache.fetched_at.desc())
        .limit(1)
    )
    if not cache:
        return None
    group = cache.payload.get("group")
    return group.get("name") if isinstance(group, dict) else None


async def list_calendar_period_ranges(db: AsyncSession, calendar_id: UUID) -> list[AcademicPeriodRange]:
    days = list(
        await db.scalars(
            select(AcademicCalendarDay)
            .where(AcademicCalendarDay.calendar_id == calendar_id)
            .order_by(AcademicCalendarDay.period_type, AcademicCalendarDay.date)
        )
    )
    blocking_dates_by_type = {
        period_type: {
            day.date
            for day in days
            if day.period_type != period_type and day.period_type not in {"holiday"}
        }
        for period_type in PERIOD_LABELS
    }
    ranges = []
    for period_type in PERIOD_LABELS:
        dates = [day.date for day in days if day.period_type == period_type]
        if not dates:
            continue
        start = previous = dates[0]
        for current in dates[1:]:
            gap_has_blocking_period = any(
                day in blocking_dates_by_type[period_type]
                for day in date_range(previous + timedelta(days=1), current - timedelta(days=1))
            )
            if not gap_has_blocking_period:
                previous = current
                continue
            ranges.append(AcademicPeriodRange(start, previous, period_type))
            start = previous = current
        ranges.append(AcademicPeriodRange(start, previous, period_type))
    return sorted(ranges, key=lambda item: (item.start_date, item.end_date, item.period_type))


def date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


async def enqueue_academic_period_notifications(db: AsyncSession, today: date | None = None) -> None:
    today = today or moscow_today()
    rows = await db.execute(
        select(UserScheduleItem, TelegramAccount)
        .join(TelegramAccount, TelegramAccount.user_id == UserScheduleItem.user_id)
        .where(
            UserScheduleItem.item_type == ScheduleItemType.GROUP.value,
            UserScheduleItem.is_primary.is_(True),
            TelegramAccount.is_active.is_(True),
        )
    )
    now = datetime.now(UTC)
    for item, telegram in rows:
        group_name = await get_cached_group_name(db, item.ruz_id)
        if not group_name:
            continue
        calendar = await get_calendar_for_group(db, group_name)
        if not calendar:
            continue
        started_periods = await list_started_periods(db, calendar.id, today)
        for day in started_periods:
            text = PERIOD_START_TEXT.get(day.period_type) or f"Начался период: {PERIOD_LABELS.get(day.period_type, day.period_type)}"
            dedupe_key = f"academic-period:{item.user_id}:{day.date.isoformat()}:{day.period_type}"
            exists = await db.scalar(select(NotificationOutbox.id).where(NotificationOutbox.dedupe_key == dedupe_key).limit(1))
            if exists:
                continue
            db.add(
                NotificationOutbox(
                    user_id=item.user_id,
                    channel=NotificationChannel.TELEGRAM.value,
                    telegram_chat_id=telegram.telegram_chat_id,
                    event_type="academic_period_started",
                    payload={"group_name": group_name, "date": day.date.isoformat(), "period_type": day.period_type},
                    text=text,
                    dedupe_key=dedupe_key,
                    next_attempt_at=now,
                    updated_at=now,
                )
            )
    await db.flush()


async def list_started_periods(db: AsyncSession, calendar_id: UUID, today: date) -> list[AcademicCalendarDay]:
    today_periods = list(
        await db.scalars(
            select(AcademicCalendarDay)
            .where(AcademicCalendarDay.calendar_id == calendar_id, AcademicCalendarDay.date == today)
            .order_by(AcademicCalendarDay.period_type)
        )
    )
    if not today_periods:
        return []

    recent_types = set(
        await db.scalars(
            select(AcademicCalendarDay.period_type).where(
                AcademicCalendarDay.calendar_id == calendar_id,
                AcademicCalendarDay.date >= today - timedelta(days=7),
                AcademicCalendarDay.date < today,
            )
        )
    )
    return [
        day
        for day in today_periods
        if day.period_type in NOTIFIABLE_PERIOD_TYPES and day.period_type not in recent_types
    ]
