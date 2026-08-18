from datetime import UTC, date, datetime

import pytest
from sqlalchemy import select

from app.schemas.ruz import Auditorium, Building, Group, GroupSchedule, Lesson, Week
from app.schedules.diff import diff_schedules, schedule_payload
from app.schedules.models import ScheduleChangeEvent
from app.schedules.service import list_saved_group_ids, save_group_schedule_cache, schedule_week_starts
from app.users.models import User, UserScheduleItem


def make_schedule(
    *,
    group_id: int = 44302,
    subject: str = "Связь",
    time_start: datetime = datetime(2026, 9, 2, 7, 0, tzinfo=UTC),
    time_end: datetime = datetime(2026, 9, 2, 8, 30, tzinfo=UTC),
    auditorium_name: str = "101",
) -> GroupSchedule:
    return GroupSchedule(
        week=Week(date_start=date(2026, 8, 31), date_end=date(2026, 9, 6), is_odd=True),
        group=Group(id=group_id, name="4931102/40101"),
        days=[
            {
                "weekday": 3,
                "date": date(2026, 9, 2),
                "lessons": [
                    Lesson(
                        subject=subject,
                        time_start=time_start,
                        time_end=time_end,
                        auditories=[
                            Auditorium(
                                id=1,
                                name=auditorium_name,
                                building=Building(id=11, name="Главное здание"),
                            )
                        ],
                    )
                ],
            }
        ],
    )


def test_diff_detects_updated_lesson_field() -> None:
    old_payload = schedule_payload(make_schedule(auditorium_name="101"))
    new_payload = schedule_payload(make_schedule(auditorium_name="102"))

    changes = diff_schedules(old_payload, new_payload)

    assert changes == [
        {
            "type": "lesson_updated",
            "before": changes[0]["before"],
            "after": changes[0]["after"],
            "fields": ["auditories"],
        }
    ]
    assert changes[0]["before"]["auditories"][0]["name"] == "101"
    assert changes[0]["after"]["auditories"][0]["name"] == "102"


def test_diff_detects_added_and_removed_lessons() -> None:
    old_payload = schedule_payload(make_schedule(subject="Старая пара"))
    new_payload = schedule_payload(make_schedule(subject="Новая пара"))

    changes = diff_schedules(old_payload, new_payload)

    assert [change["type"] for change in changes] == ["lesson_removed", "lesson_added"]
    assert changes[0]["lesson"]["subject"] == "Старая пара"
    assert changes[1]["lesson"]["subject"] == "Новая пара"


def test_diff_treats_unique_time_move_as_update() -> None:
    old_payload = schedule_payload(make_schedule(time_start=datetime(2026, 9, 2, 7, 0, tzinfo=UTC)))
    new_payload = schedule_payload(make_schedule(time_start=datetime(2026, 9, 2, 9, 0, tzinfo=UTC)))

    changes = diff_schedules(old_payload, new_payload)

    assert [change["type"] for change in changes] == ["lesson_updated"]
    assert changes[0]["fields"] == ["time_start"]


@pytest.mark.asyncio
async def test_save_group_schedule_cache_creates_change_event(override_db: None, db_session) -> None:
    await save_group_schedule_cache(db_session, make_schedule(auditorium_name="101"))
    await save_group_schedule_cache(db_session, make_schedule(auditorium_name="102"))

    events = list(await db_session.scalars(select(ScheduleChangeEvent)))

    assert len(events) == 1
    assert events[0].changes[0]["type"] == "lesson_updated"
    assert events[0].changes[0]["fields"] == ["auditories"]


@pytest.mark.asyncio
async def test_refresh_uses_distinct_saved_groups(override_db: None, db_session) -> None:
    first_user = User(identity_hash="first")
    second_user = User(identity_hash="second")
    db_session.add_all([first_user, second_user])
    await db_session.flush()
    db_session.add_all(
        [
            UserScheduleItem(user_id=first_user.id, item_type="group", ruz_id=44302, is_primary=True),
            UserScheduleItem(user_id=second_user.id, item_type="group", ruz_id=44302),
            UserScheduleItem(user_id=second_user.id, item_type="teacher", ruz_id=9833),
        ]
    )
    await db_session.flush()

    assert await list_saved_group_ids(db_session) == [44302]


def test_schedule_week_starts_covers_next_week_when_needed() -> None:
    assert schedule_week_starts(date(2026, 8, 31)) == [date(2026, 8, 31)]
    assert schedule_week_starts(date(2026, 9, 4)) == [date(2026, 8, 31), date(2026, 9, 7)]
