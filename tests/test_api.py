import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_ruz_client
from app.buildings.models import BuildingMapLink
from app.clients.ruz import RuzApiError
from app.main import app
from app.schemas.ruz import Faculty, Teacher, TeacherSchedule, Week


class FakeRuzClient:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail

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
        raise AssertionError("mocked 42828 schedule should not call RUZ")


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
async def test_group_42828_current_week_returns_api_mock() -> None:
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
