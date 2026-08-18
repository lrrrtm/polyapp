from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import distinct, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.clients.ruz import RuzApiError, RuzClient, RuzNotFoundError
from app.core.config import Settings
from app.schemas.ruz import GroupSchedule, ScheduleMeta
from app.schedules.diff import diff_schedules, schedule_hash, schedule_payload
from app.schedules.models import ScheduleCache, ScheduleChangeEvent
from app.users.models import ScheduleItemType, User, UserScheduleItem

logger = logging.getLogger(__name__)
SCHEDULE_REFRESH_LOCK_ID = 2026081801


def week_start_for(day: date) -> date:
    return day - timedelta(days=day.weekday())


def schedule_week_starts(today: date | None = None) -> list[date]:
    start = week_start_for(today or date.today())
    end = week_start_for((today or date.today()) + timedelta(days=6))
    return [start] if end == start else [start, end]


async def get_group_schedule_cached_or_live(
    db: AsyncSession,
    ruz: RuzClient,
    group_id: int,
    schedule_date: date | None,
) -> GroupSchedule:
    week_start = week_start_for(schedule_date or date.today())
    try:
        schedule = await ruz.get_group_schedule(group_id, schedule_date)
    except RuzNotFoundError:
        raise
    except RuzApiError as error:
        if await get_cache_row(db, group_id, week_start):
            await mark_cache_refresh_failed(db, group_id, week_start, str(error))
            cached = await get_cached_group_schedule(db, group_id, week_start, stale=True)
            if cached:
                return cached
        raise

    if await is_group_saved(db, group_id):
        await save_group_schedule_cache(db, schedule)

    schedule.meta = ScheduleMeta(source="live", is_stale=False)
    return schedule


async def get_cached_group_schedule(
    db: AsyncSession,
    group_id: int,
    week_start: date,
    *,
    stale: bool,
) -> GroupSchedule | None:
    cache = await get_cache_row(db, group_id, week_start)
    if not cache:
        return None

    schedule = GroupSchedule.model_validate(cache.payload)
    schedule.meta = ScheduleMeta(
        source="cache",
        is_stale=stale,
        fetched_at=cache.fetched_at,
        failed_refresh_at=cache.last_refresh_failed_at,
    )
    return schedule


async def save_group_schedule_cache(db: AsyncSession, schedule: GroupSchedule) -> ScheduleCache:
    payload = schedule_payload(schedule)
    payload_hash = schedule_hash(payload)
    week_start = schedule.week.date_start
    now = datetime.now(UTC)
    cache = await get_cache_row(db, schedule.group.id, week_start)

    if cache is None:
        cache = ScheduleCache(
            item_type=ScheduleItemType.GROUP.value,
            ruz_id=schedule.group.id,
            week_start=week_start,
            payload=payload,
            payload_hash=payload_hash,
            fetched_at=now,
            updated_at=now,
        )
        db.add(cache)
        await db.flush()
        return cache

    if cache.payload_hash != payload_hash:
        changes = diff_schedules(cache.payload, payload)
        if changes:
            db.add(
                ScheduleChangeEvent(
                    item_type=ScheduleItemType.GROUP.value,
                    ruz_id=schedule.group.id,
                    week_start=week_start,
                    detected_at=now,
                    old_hash=cache.payload_hash,
                    new_hash=payload_hash,
                    changes=changes,
                )
            )

    cache.payload = payload
    cache.payload_hash = payload_hash
    cache.fetched_at = now
    cache.last_refresh_failed_at = None
    cache.last_error = None
    cache.updated_at = now
    await db.flush()
    return cache


async def mark_cache_refresh_failed(db: AsyncSession, group_id: int, week_start: date, error: str) -> None:
    cache = await get_cache_row(db, group_id, week_start)
    if not cache:
        return

    cache.last_refresh_failed_at = datetime.now(UTC)
    cache.last_error = error
    cache.updated_at = datetime.now(UTC)
    await db.flush()


async def get_cache_row(db: AsyncSession, group_id: int, week_start: date) -> ScheduleCache | None:
    return await db.scalar(
        select(ScheduleCache).where(
            ScheduleCache.item_type == ScheduleItemType.GROUP.value,
            ScheduleCache.ruz_id == group_id,
            ScheduleCache.week_start == week_start,
        )
    )


async def is_group_saved(db: AsyncSession, group_id: int) -> bool:
    return (
        await db.scalar(
            select(UserScheduleItem.id)
            .where(
                UserScheduleItem.item_type == ScheduleItemType.GROUP.value,
                UserScheduleItem.ruz_id == group_id,
            )
            .limit(1)
        )
    ) is not None


async def list_saved_group_ids(db: AsyncSession) -> list[int]:
    result = await db.scalars(
        select(distinct(UserScheduleItem.ruz_id))
        .where(UserScheduleItem.item_type == ScheduleItemType.GROUP.value)
        .order_by(UserScheduleItem.ruz_id)
    )
    return list(result)


async def list_user_schedule_changes(
    db: AsyncSession,
    user: User,
    *,
    since: datetime | None = None,
    limit: int = 100,
) -> list[ScheduleChangeEvent]:
    week_starts = schedule_week_starts()
    statement = (
        select(ScheduleChangeEvent)
        .join(
            UserScheduleItem,
            (UserScheduleItem.item_type == ScheduleChangeEvent.item_type)
            & (UserScheduleItem.ruz_id == ScheduleChangeEvent.ruz_id),
        )
        .where(
            UserScheduleItem.user_id == user.id,
            ScheduleChangeEvent.item_type == ScheduleItemType.GROUP.value,
            ScheduleChangeEvent.week_start.in_(week_starts),
        )
        .order_by(ScheduleChangeEvent.detected_at.desc())
        .limit(limit)
    )
    if since:
        statement = statement.where(ScheduleChangeEvent.detected_at > since)

    return list(await db.scalars(statement))


async def refresh_saved_group_schedules(
    *,
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    ruz: RuzClient,
    in_process_lock: asyncio.Lock,
) -> None:
    async with in_process_lock:
        async with session_factory() as db:
            if not await _try_advisory_lock(db):
                return
            try:
                group_ids = await list_saved_group_ids(db)
                week_starts = schedule_week_starts()
                await _refresh_groups(db, ruz, group_ids, week_starts, settings.schedule_refresh_concurrency)
                await db.commit()
            finally:
                await _release_advisory_lock(db)


async def _refresh_groups(
    db: AsyncSession,
    ruz: RuzClient,
    group_ids: list[int],
    week_starts: list[date],
    concurrency: int,
) -> None:
    semaphore = asyncio.Semaphore(concurrency)

    async def fetch_one(group_id: int, week_start: date) -> tuple[int, date, GroupSchedule | None, str | None]:
        async with semaphore:
            try:
                return group_id, week_start, await ruz.get_group_schedule(group_id, week_start), None
            except RuzApiError as error:
                return group_id, week_start, None, str(error)

    tasks = [fetch_one(group_id, week_start) for group_id in group_ids for week_start in week_starts]
    for group_id, week_start, schedule, error in await asyncio.gather(*tasks):
        if error:
            logger.warning("RUZ schedule refresh failed group_id=%s week_start=%s: %s", group_id, week_start, error)
            await mark_cache_refresh_failed(db, group_id, week_start, error)
            continue

        if schedule:
            await save_group_schedule_cache(db, schedule)


async def _try_advisory_lock(db: AsyncSession) -> bool:
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return True

    return bool(await db.scalar(text("select pg_try_advisory_lock(:lock_id)").bindparams(lock_id=SCHEDULE_REFRESH_LOCK_ID)))


async def _release_advisory_lock(db: AsyncSession) -> None:
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        await db.execute(text("select pg_advisory_unlock(:lock_id)").bindparams(lock_id=SCHEDULE_REFRESH_LOCK_ID))
