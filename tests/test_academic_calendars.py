from datetime import date
from zipfile import ZipFile
from io import BytesIO
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.academic_calendars.group_mapping import parse_group_academic_calendar_key
from app.academic_calendars.importer import CalendarImportCandidate, extract_pdf_from_zip, parse_calendar_candidates, save_calendar
from app.academic_calendars.models import AcademicCalendar, AcademicCalendarDay
from app.academic_calendars.pdf_parser import ColoredRect, MonthAnchor, ParsedAcademicCalendarDay, find_month_anchor, parse_academic_calendar_pdf
from app.academic_calendars.service import enqueue_academic_period_notifications, get_current_academic_calendar, list_calendar_period_ranges
from app.main import app
from app.notifications.models import NotificationOutbox, TelegramAccount
from app.schemas.ruz import Group, GroupSchedule, Week
from app.schedules.service import save_group_schedule_cache
from app.users.models import User, UserScheduleItem


def test_parse_group_academic_calendar_key() -> None:
    first = parse_group_academic_calendar_key("5140904/60401")
    second = parse_group_academic_calendar_key("5140904/60101")
    third = parse_group_academic_calendar_key("4741601/51301")

    assert first is not None
    assert first.direction_code == "09.04.04"
    assert first.level == 4
    assert first.admission_year == 2026
    assert second is not None
    assert second.direction_code == "09.04.04"
    assert third is not None
    assert third.direction_code == "16.04.01"
    assert third.level == 4
    assert third.admission_year == 2025
    assert parse_group_academic_calendar_key("группа") is None


def test_parse_calendar_candidates_dedupes_profiles() -> None:
    html = """
    <table>
      <tr>
        <td itemprop="eduProf">09.04.04_01<br>Первый профиль</td>
        <td itemprop="eduForm">Очная</td>
        <td itemprop="educationShedule">
          <a href="/calendar_09.04.04_01_o_2026.zip">прием 2026 года</a>
        </td>
      </tr>
      <tr>
        <td itemprop="eduProf">09.04.04_02<br>Второй профиль</td>
        <td itemprop="eduForm">Очная</td>
        <td itemprop="educationShedule">
          <a href="/calendar_09.04.04_02_o_2026.zip">прием 2026 года</a>
        </td>
      </tr>
    </table>
    """

    candidates = parse_calendar_candidates(html, "https://www.spbstu.ru/page/")

    assert len(candidates) == 1
    assert candidates[0].direction_code == "09.04.04"
    assert candidates[0].level == 4
    assert candidates[0].admission_year == 2026
    assert candidates[0].source_program_code == "09.04.04_01"


def test_extract_pdf_from_zip() -> None:
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("calendar.pdf", b"%PDF")
        archive.writestr("calendar.pdf.sgn", b"signature")

    assert extract_pdf_from_zip(buffer.getvalue()) == b"%PDF"


def test_parse_academic_calendar_pdf_reads_colored_days() -> None:
    import pymupdf

    pdf = pymupdf.open()
    page = pdf.new_page(width=300, height=260)
    page.insert_text((80, 20), "september 2026", fontsize=12)
    page.draw_rect(pymupdf.Rect(80, 50, 100, 70), color=None, fill=(129 / 255, 199 / 255, 132 / 255))
    page.insert_text((86, 65), "1", fontsize=12)
    page.insert_text((80, 120), "september 2027", fontsize=12)
    page.draw_rect(pymupdf.Rect(80, 150, 100, 170), color=None, fill=(186 / 255, 104 / 255, 200 / 255))
    page.insert_text((86, 165), "2", fontsize=12)

    days = parse_academic_calendar_pdf(pdf.tobytes(deflate=True))

    assert days == [
        ParsedAcademicCalendarDay(date(2026, 9, 1), "theory"),
        ParsedAcademicCalendarDay(date(2027, 9, 2), "exam"),
    ]


def test_find_month_anchor_prefers_horizontal_match_within_same_row() -> None:
    anchors = [
        MonthAnchor(month=1, year=2028, x=573.91, y=31.35022),
        MonthAnchor(month=2, year=2028, x=686.40, y=31.35027),
    ]
    rect = ColoredRect(x0=597.92, y0=81.60, x1=613.42, y1=98.61, rgb=(186, 104, 200))

    anchor = find_month_anchor(rect, anchors)

    assert anchor == anchors[0]


@pytest.mark.asyncio
async def test_save_calendar_replaces_days_without_duplicates(override_db: None, db_session) -> None:
    candidate = make_candidate()
    await save_calendar(
        db_session,
        candidate,
        [
            ParsedAcademicCalendarDay(date(2026, 9, 1), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 1), "theory"),
        ],
    )
    await save_calendar(db_session, candidate, [ParsedAcademicCalendarDay(date(2026, 9, 2), "exam")])

    calendars = list(await db_session.scalars(select(AcademicCalendar)))
    days = list(await db_session.scalars(select(AcademicCalendarDay)))

    assert len(calendars) == 1
    assert [(day.date, day.period_type) for day in days] == [(date(2026, 9, 2), "exam")]


@pytest.mark.asyncio
async def test_current_academic_calendar_returns_current_and_next_period(override_db: None, db_session) -> None:
    user = await seed_user_with_group_cache(db_session)
    await save_calendar(
        db_session,
        make_candidate(),
        [
            ParsedAcademicCalendarDay(date(2026, 9, 1), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 2), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 3), "exam"),
        ],
    )

    current = await get_current_academic_calendar(db_session, user, date(2026, 9, 1))

    assert current is not None
    group_name, calendar, current_periods, next_period, periods = current
    assert group_name == "5140904/60401"
    assert calendar.direction_code == "09.04.04"
    assert [period.period_type for period in current_periods] == ["theory"]
    assert next_period is not None
    assert next_period.date == date(2026, 9, 3)
    assert [(period.start_date, period.end_date, period.period_type) for period in periods] == [
        (date(2026, 9, 1), date(2026, 9, 2), "theory"),
        (date(2026, 9, 3), date(2026, 9, 3), "exam"),
    ]


@pytest.mark.asyncio
async def test_calendar_period_ranges_merge_blank_gaps_but_not_other_periods(override_db: None, db_session) -> None:
    candidate = make_candidate()
    await save_calendar(
        db_session,
        candidate,
        [
            ParsedAcademicCalendarDay(date(2026, 9, 1), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 2), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 7), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 8), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 9), "holiday"),
            ParsedAcademicCalendarDay(date(2026, 9, 14), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 21), "exam"),
            ParsedAcademicCalendarDay(date(2026, 9, 28), "theory"),
        ],
    )
    calendar = await db_session.scalar(select(AcademicCalendar).where(AcademicCalendar.direction_code == candidate.direction_code))
    assert calendar is not None

    periods = await list_calendar_period_ranges(db_session, calendar.id)

    assert [(period.start_date, period.end_date, period.period_type) for period in periods] == [
        (date(2026, 9, 1), date(2026, 9, 14), "theory"),
        (date(2026, 9, 9), date(2026, 9, 9), "holiday"),
        (date(2026, 9, 21), date(2026, 9, 21), "exam"),
        (date(2026, 9, 28), date(2026, 9, 28), "theory"),
    ]


@pytest.mark.asyncio
async def test_current_academic_calendar_endpoint_returns_404_when_missing(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        response = await client.get("/api/v1/me/academic-calendar/current")

    assert response.status_code == 404
    assert response.json()["code"] == "ACADEMIC_CALENDAR_NOT_FOUND"


@pytest.mark.asyncio
async def test_current_academic_calendar_endpoint_returns_payload(override_db: None, db_session) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        me = await client.post("/api/v1/me")
        user = await db_session.get(User, UUID(me.json()["id"]))
        assert user is not None
        db_session.add(UserScheduleItem(user_id=user.id, item_type="group", ruz_id=44302, is_primary=True))
        await save_group_schedule_cache(
            db_session,
            GroupSchedule(
                week=Week(date_start=date(2026, 8, 31), date_end=date(2026, 9, 6), is_odd=True),
                group=Group(id=44302, name="5140904/60401"),
                days=[],
            ),
        )
        await save_calendar(db_session, make_candidate(), [ParsedAcademicCalendarDay(date.today(), "vacation")])
        await db_session.commit()
        response = await client.get("/api/v1/me/academic-calendar/current")

    assert response.status_code == 200
    assert response.json()["current_periods"] == [{"date": date.today().isoformat(), "period_type": "vacation"}]
    assert response.json()["periods"] == [
        {"start_date": date.today().isoformat(), "end_date": date.today().isoformat(), "period_type": "vacation"}
    ]


@pytest.mark.asyncio
async def test_academic_period_notification_is_enqueued_once(override_db: None, db_session) -> None:
    user = await seed_user_with_group_cache(db_session)
    db_session.add(TelegramAccount(user_id=user.id, telegram_user_id=1, telegram_chat_id=2, is_active=True))
    await save_calendar(
        db_session,
        make_candidate(),
        [
            ParsedAcademicCalendarDay(date(2026, 9, 1), "theory"),
            ParsedAcademicCalendarDay(date(2026, 9, 2), "exam"),
        ],
    )
    await db_session.flush()

    await enqueue_academic_period_notifications(db_session, date(2026, 9, 2))
    await enqueue_academic_period_notifications(db_session, date(2026, 9, 2))

    notifications = list(await db_session.scalars(select(NotificationOutbox).where(NotificationOutbox.event_type == "academic_period_started")))
    assert len(notifications) == 1
    assert notifications[0].dedupe_key == f"academic-period:{user.id}:2026-09-02:exam"
    assert notifications[0].text == "Начался период: экзамены"


@pytest.mark.asyncio
async def test_academic_period_notification_ignores_weekend_gap(override_db: None, db_session) -> None:
    user = await seed_user_with_group_cache(db_session)
    db_session.add(TelegramAccount(user_id=user.id, telegram_user_id=1, telegram_chat_id=2, is_active=True))
    await save_calendar(
        db_session,
        make_candidate(),
        [
            ParsedAcademicCalendarDay(date(2026, 9, 4), "exam"),
            ParsedAcademicCalendarDay(date(2026, 9, 7), "exam"),
        ],
    )
    await db_session.flush()

    await enqueue_academic_period_notifications(db_session, date(2026, 9, 7))

    notifications = list(await db_session.scalars(select(NotificationOutbox).where(NotificationOutbox.event_type == "academic_period_started")))
    assert notifications == []


def make_candidate() -> CalendarImportCandidate:
    return CalendarImportCandidate(
        source_program_code="09.04.04_01",
        direction_code="09.04.04",
        level=4,
        admission_year=2026,
        education_form="full_time",
        source_url="https://www.spbstu.ru/calendar.zip",
    )


async def seed_user_with_group_cache(db_session, identity_hash: str = "student") -> User:
    user = User(identity_hash=identity_hash)
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserScheduleItem(user_id=user.id, item_type="group", ruz_id=44302, is_primary=True))
    await save_group_schedule_cache(
        db_session,
        GroupSchedule(
            week=Week(date_start=date(2026, 8, 31), date_end=date(2026, 9, 6), is_odd=True),
            group=Group(id=44302, name="5140904/60401"),
            days=[],
        ),
    )
    await db_session.flush()
    return user
