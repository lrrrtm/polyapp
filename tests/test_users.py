import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_ruz_client
from app.clients.ruz import RuzApiError, RuzNotFoundError
from app.main import app
from app.users.models import ScheduleItemType


class FakeRuzClient:
    def __init__(
        self,
        missing_groups: set[int] | None = None,
        missing_teachers: set[int] | None = None,
        fail: bool = False,
    ) -> None:
        self.missing_groups = missing_groups or set()
        self.missing_teachers = missing_teachers or set()
        self.fail = fail

    async def ensure_group_exists(self, group_id: int) -> None:
        if self.fail:
            raise RuzApiError("RUZ unavailable")
        if group_id in self.missing_groups:
            raise RuzNotFoundError(f"Группа: {group_id} не найдена")

    async def ensure_teacher_exists(self, teacher_id: int) -> None:
        if self.fail:
            raise RuzApiError("RUZ unavailable")
        if teacher_id in self.missing_teachers:
            raise RuzNotFoundError(f"Преподаватель: {teacher_id} не найден")


@pytest.fixture
def override_ruz() -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient()
    yield
    app.dependency_overrides.pop(get_ruz_client, None)


@pytest.mark.asyncio
async def test_get_me_without_user_returns_not_found(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/me")

    assert response.status_code == 404
    assert response.json()["code"] == "USER_NOT_FOUND"


@pytest.mark.asyncio
async def test_post_me_creates_anonymous_user_and_sets_cookie(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/me")

    assert response.status_code == 200
    assert response.json()["primary_group"] is None
    assert response.json()["favorites"] == []
    assert response.json()["applicant_code"] is None
    assert "polytech_user" in response.cookies


@pytest.mark.asyncio
async def test_session_reports_missing_and_existing_cookie(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        missing = await client.get("/api/v1/session")
        await client.post("/api/v1/me")
        existing = await client.get("/api/v1/session")

    assert missing.status_code == 200
    assert missing.json() == {"has_user": False}
    assert existing.status_code == 200
    assert existing.json() == {"has_user": True}


@pytest.mark.asyncio
async def test_post_me_reuses_cookie_user(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post("/api/v1/me")
        second = await client.post("/api/v1/me")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]


@pytest.mark.asyncio
async def test_set_primary_group_keeps_single_primary(override_db: None, override_ruz: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        first = await client.put("/api/v1/me/primary-group", json={"ruz_id": 42828})
        second = await client.put("/api/v1/me/primary-group", json={"ruz_id": 45476})

    assert first.status_code == 200
    assert first.json()["primary_group"]["ruz_id"] == 42828
    assert second.status_code == 200
    assert second.json()["primary_group"]["ruz_id"] == 45476
    assert [item["ruz_id"] for item in second.json()["favorites"]] == [42828]


@pytest.mark.asyncio
async def test_add_group_and_teacher_favorites_without_duplicates(
    override_db: None,
    override_ruz: None,
) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        group = await client.post("/api/v1/me/favorites", json={"item_type": "group", "ruz_id": 42828})
        duplicate_group = await client.post("/api/v1/me/favorites", json={"item_type": "group", "ruz_id": 42828})
        teacher = await client.post("/api/v1/me/favorites", json={"item_type": "teacher", "ruz_id": 9833})
        favorites = await client.get("/api/v1/me/favorites")

    assert group.status_code == 200
    assert duplicate_group.status_code == 200
    assert group.json()["id"] == duplicate_group.json()["id"]
    assert teacher.status_code == 200
    assert favorites.status_code == 200
    assert {(item["item_type"], item["ruz_id"]) for item in favorites.json()} == {
        ("group", 42828),
        ("teacher", 9833),
    }


@pytest.mark.asyncio
async def test_delete_favorite(override_db: None, override_ruz: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        created = await client.post("/api/v1/me/favorites", json={"item_type": "teacher", "ruz_id": 9833})
        deleted = await client.delete(f"/api/v1/me/favorites/{created.json()['id']}")
        favorites = await client.get("/api/v1/me/favorites")

    assert deleted.status_code == 204
    assert favorites.json() == []


@pytest.mark.asyncio
async def test_primary_group_rejects_unknown_group(override_db: None) -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient(missing_groups={4549423423432})
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/me")
            response = await client.put("/api/v1/me/primary-group", json={"ruz_id": 4549423423432})
            profile = await client.get("/api/v1/me")
    finally:
        app.dependency_overrides.pop(get_ruz_client, None)

    assert response.status_code == 404
    assert response.json()["code"] == "RUZ_GROUP_NOT_FOUND"
    assert response.json()["message"] == "Группа не найдена в расписании Политеха."
    assert response.json()["details"] == {
        "service": "ruz",
        "resource": "group",
        "ruz_id": 4549423423432,
    }
    assert "не найдена" not in response.json()["title"]
    assert profile.json()["primary_group"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("item_type", "missing_groups", "missing_teachers"),
    [
        (ScheduleItemType.GROUP, {4549423423432}, set()),
        (ScheduleItemType.TEACHER, set(), {4549423423432}),
    ],
)
async def test_favorite_rejects_unknown_ruz_id(
    override_db: None,
    item_type: ScheduleItemType,
    missing_groups: set[int],
    missing_teachers: set[int],
) -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient(
        missing_groups=missing_groups,
        missing_teachers=missing_teachers,
    )
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/me")
            response = await client.post(
                "/api/v1/me/favorites",
                json={"item_type": item_type.value, "ruz_id": 4549423423432},
            )
            favorites = await client.get("/api/v1/me/favorites")
    finally:
        app.dependency_overrides.pop(get_ruz_client, None)

    assert response.status_code == 404
    expected_code = "RUZ_GROUP_NOT_FOUND" if item_type == ScheduleItemType.GROUP else "RUZ_TEACHER_NOT_FOUND"
    assert response.json()["code"] == expected_code
    assert response.json()["details"]["ruz_id"] == 4549423423432
    assert favorites.json() == []


@pytest.mark.asyncio
async def test_favorite_returns_bad_gateway_on_ruz_failure(override_db: None) -> None:
    app.dependency_overrides[get_ruz_client] = lambda: FakeRuzClient(fail=True)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/me")
            response = await client.post("/api/v1/me/favorites", json={"item_type": "group", "ruz_id": 42828})
    finally:
        app.dependency_overrides.pop(get_ruz_client, None)

    assert response.status_code == 502
    assert response.json()["code"] == "RUZ_UPSTREAM_ERROR"
    assert response.json()["message"] == "Сервис расписания временно недоступен. Попробуйте позже."
    assert response.json()["details"] == {
        "service": "ruz",
        "resource": "group",
        "ruz_id": 42828,
    }
    assert "RUZ unavailable" not in response.text
