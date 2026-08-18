from datetime import UTC, date, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_ruz_client
from app.buildings.models import BuildingMapLink
from app.clients.ruz import RuzApiError
from app.main import app
from app.schemas.ruz import Faculty, Group, GroupSchedule, Teacher, TeacherSchedule, Week
from app.schedules.models import ScheduleCache, ScheduleChangeEvent
from app.schedules.service import save_group_schedule_cache, schedule_week_starts
from app.users.deps import hash_identity_token
from app.users.models import User, UserScheduleItem


class FakeRuzClient:
    def __init__(self, fail: bool = False, group_schedule: GroupSchedule | None = None) -> None:
        self.fail = fail
        self.group_schedule = group_schedule

    async def get_faculties(self) -> list[Faculty]:
        if self.fail:
            raise RuzApiError("raw RUZ failure")
        return [Faculty(id=125, name="Институт компьютерных наук и кибербезопасности", abbr="ИКНК")]

    async def search_teachers(self, query: str) -> list[Teacher]:
        return [Teacher(id=9833, oid=31878, full_name=f"{query} Валерий Иванович")]

    async def get_teacher_schedule(self, teacher_id: int, schedule_date: object = None) -> TeacherSchedule:
        return TeacherSchedule(
            week=Week(date_start="2026.04.13", date_end="2026.04.19", is_odd=True),
            teacher=Teacher(id=teacher_id, full_name="Бабенков Валерий Иванович"),
            days=[],
        )

    async def get_group_schedule(self, group_id: int, schedule_date: object = None) -> object:
        if self.fail:
            raise RuzApiError("raw RUZ failure")
        if self.group_schedule:
            return self.group_schedule
        raise AssertionError("mocked 42828 schedule should not call RUZ")


def make_group_schedule(group_id: int = 44302) -> GroupSchedule:
    return GroupSchedule(
        week=Week(date_start="2026.08.31", date_end="2026.09.06", is_odd=True),
        group=Group(id=group_id, name="4931102/40101"),
        days=[
            {
                "weekday": 3,
                "date": date(2026, 9, 2),
                "lessons": [
                    {
                        "subject": "Связь",
                        "time_start": datetime(2026, 9, 2, 7, 0, tzinfo=UTC),
                        "time_end": datetime(2026, 9, 2, 8, 30, tzinfo=UTC),
                        "auditories": [],
                    }
                ],
            }
        ],
    )


@pytest.mark.asyncio
async def test_health() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Request-ID"]


@pytest.mark.asyncio
async def test_faculties_with_dependency_override() -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/faculties")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": 125,
            "name": "Институт компьютерных наук и кибербезопасности",
            "abbr": "ИКНК",
        }
    ]


@pytest.mark.asyncio
async def test_search_teachers_with_dependency_override() -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/teachers/search", params={"q": "Бабенков"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["id"] == 9833


@pytest.mark.asyncio
async def test_teacher_schedule_with_dependency_override() -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/teachers/9833/schedule", params={"date": "2026-04-13"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["teacher"]["id"] == 9833
    assert response.json()["days"] == []


@pytest.mark.asyncio
async def test_group_42828_current_week_returns_api_mock(override_db: None) -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/groups/42828/schedule")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["group"]["id"] == 42828
    assert data["days"][0]["lessons"][0]["subject"] == "Математический анализ"
    assert data["days"][0]["lessons"][0]["time_start"].endswith("Z")


@pytest.mark.asyncio
async def test_group_schedule_live_response_updates_cache(override_db: None, db_session: AsyncSession) -> None:
    user = User(identity_hash="user")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserScheduleItem(user_id=user.id, item_type="group", ruz_id=44302, is_primary=True))
    await db_session.flush()
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient(group_schedule=make_group_schedule())
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/groups/44302/schedule", params={"date": "2026-08-31"})
    finally:
        app.dependency_overrides.pop(get_ruz_client, None)

    assert response.status_code == 200
    assert response.json()["meta"] == {"source": "live", "is_stale": False, "fetched_at": None, "failed_refresh_at": None}
    cache = await db_session.scalar(select(ScheduleCache))
    assert cache is not None
    assert cache.ruz_id == 44302


@pytest.mark.asyncio
async def test_group_schedule_returns_stale_cache_when_ruz_fails(override_db: None, db_session: AsyncSession) -> None:
    await save_group_schedule_cache(db_session, make_group_schedule())
    await db_session.flush()
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient(fail=True)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/groups/44302/schedule", params={"date": "2026-08-31"})
    finally:
        app.dependency_overrides.pop(get_ruz_client, None)

    assert response.status_code == 200
    assert response.json()["meta"]["source"] == "cache"
    assert response.json()["meta"]["is_stale"] is True
    assert response.json()["meta"]["failed_refresh_at"] is not None
    assert response.json()["days"][0]["lessons"][0]["subject"] == "Связь"


@pytest.mark.asyncio
async def test_group_schedule_returns_bad_gateway_without_cache(override_db: None) -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient(fail=True)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/groups/44302/schedule", params={"date": "2026-08-31"})
    finally:
        app.dependency_overrides.pop(get_ruz_client, None)

    assert response.status_code == 502
    assert response.json()["code"] == "RUZ_UPSTREAM_ERROR"


@pytest.mark.asyncio
async def test_schedule_changes_returns_current_user_saved_group_events(
    override_db: None,
    db_session: AsyncSession,
) -> None:
    token = "schedule-user"
    user = User(identity_hash=hash_identity_token(token))
    other_user = User(identity_hash="other-user")
    db_session.add_all([user, other_user])
    await db_session.flush()
    db_session.add_all(
        [
            UserScheduleItem(user_id=user.id, item_type="group", ruz_id=44302),
            UserScheduleItem(user_id=other_user.id, item_type="group", ruz_id=45476),
            ScheduleChangeEvent(
                item_type="group",
                ruz_id=44302,
                week_start=schedule_week_starts()[0],
                detected_at=datetime(2026, 9, 1, 10, 0, tzinfo=UTC),
                old_hash="old",
                new_hash="new",
                changes=[{"type": "lesson_added", "lesson": {"subject": "Связь"}}],
            ),
            ScheduleChangeEvent(
                item_type="group",
                ruz_id=45476,
                week_start=schedule_week_starts()[0],
                detected_at=datetime(2026, 9, 1, 10, 0, tzinfo=UTC),
                old_hash="old",
                new_hash="new",
                changes=[{"type": "lesson_added", "lesson": {"subject": "Чужая"}}],
            ),
        ]
    )
    await db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", cookies={"polytech_user": token}) as client:
        response = await client.get("/api/v1/me/schedule-changes")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["ruz_id"] == 44302
    assert response.json()[0]["changes"][0]["lesson"]["subject"] == "Связь"


@pytest.mark.asyncio
async def test_building_map_links(override_db: None, db_session: AsyncSession) -> None:
    db_session.add(BuildingMapLink(building_id=11, yandex_maps_id="CTcnzS~s"))
    await db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/buildings/map-links")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": response.json()[0]["id"],
            "building_id": 11,
            "yandex_maps_id": "CTcnzS~s",
            "yandex_maps_url": "https://yandex.ru/maps/-/CTcnzS~s",
        }
    ]


@pytest.mark.asyncio
async def test_ruz_route_hides_raw_upstream_error() -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient(fail=True)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/faculties", headers={"X-Request-ID": "test-request-id"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 502
    assert response.headers["X-Request-ID"] == "test-request-id"
    assert response.json() == {
        "type": "https://polytech.local/errors/ruz-upstream-error",
        "title": "Schedule service unavailable",
        "status": 502,
        "code": "RUZ_UPSTREAM_ERROR",
        "message": "Сервис расписания временно недоступен. Попробуйте позже.",
        "request_id": "test-request-id",
        "details": {"service": "ruz"},
    }
    assert "raw RUZ failure" not in response.text


def test_openapi_documents_problem_error_responses() -> None:
    app.openapi_schema = None
    schema = app.openapi()

    assert "ErrorResponse" in schema["components"]["schemas"]

    documented_responses = {
        ("/api/v1/faculties", "get"): {"502"},
        ("/api/v1/faculties/{faculty_id}/groups", "get"): {"404", "502"},
        ("/api/v1/groups/search", "get"): {"502"},
        ("/api/v1/groups/{group_id}/schedule", "get"): {"404", "502"},
        ("/api/v1/teachers/search", "get"): {"502"},
        ("/api/v1/teachers/{teacher_id}/schedule", "get"): {"404", "502"},
        ("/api/v1/me/primary-group", "put"): {"404", "502"},
        ("/api/v1/me/favorites", "post"): {"404", "502"},
        ("/api/v1/me/favorites/{item_id}", "delete"): {"404"},
        ("/api/v1/me/admissions", "get"): {"404", "503"},
    }

    for (path, method), status_codes in documented_responses.items():
        responses = schema["paths"][path][method]["responses"]
        assert status_codes <= set(responses)
        for status_code in status_codes:
            content = responses[status_code]["content"]
            assert set(content) == {"application/problem+json"}
            assert content["application/problem+json"]["schema"] == {
                "$ref": "#/components/schemas/ErrorResponse"
            }
