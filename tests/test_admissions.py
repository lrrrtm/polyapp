from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.admissions.service import save_admission_index, set_applicant_code
from app.core.config import get_settings
from app.main import app
from app.users.deps import hash_identity_token
from app.users.models import User
from app.users.service import create_user


def make_index(*, code: str = "1383351", program_id: int = 657, fetched_offset_minutes: int = 0) -> dict:
    now = datetime.now(timezone.utc) + timedelta(minutes=fetched_offset_minutes)
    return {
        "source": "https://my.spbstu.ru",
        "started_at": now,
        "finished_at": now,
        "fetched_at": now,
        "failed_programs": 0,
        "total_programs": 1,
        "total_rows": 1,
        "matches": [
            {
                "applicant_code": code,
                "level": "master_pre_competition_lists",
                "form": "2",
                "condition": "1",
                "program_id": program_id,
                "program_title": "Program",
                "places": 29,
                "applications": 747,
                "date_info": "13.08.2026 20:00",
                "row": {
                    "code": code,
                    "comment_status": "К зачислению",
                    "sum": 99,
                    "priority": 1,
                    "agreement": "Получено",
                    "highest_passing_priority": "Да",
                },
                "passing_position": 21,
                "passing_total": 29,
                "technical_position": 21,
                "current_position": 52,
                "passes_now": True,
                "technically_passes": True,
            }
        ],
    }


def make_enrolled_index() -> dict:
    index = make_index(code="1824749", program_id=649)
    match = index["matches"][0]
    match["row"] = {
        "code": "1824749",
        "num": 20,
        "comment_status": "Зачислен",
        "sum": 299,
        "priority": 1,
        "agreement": "Получено",
    }
    match["passing_position"] = None
    match["technical_position"] = 1
    match["current_position"] = 1
    return index


async def create_client_user(db_session: AsyncSession, client: AsyncClient, token: str = "test-token") -> User:
    user = await create_user(db_session, hash_identity_token(token))
    client.cookies.set(get_settings().user_cookie_name, token)
    return user


@pytest.mark.asyncio
async def test_applicant_code_can_be_saved_and_deleted(
    override_db: None,
    db_session: AsyncSession,
) -> None:
    await save_admission_index(db_session, make_index())
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        saved = await client.put("/api/v1/me/applicant-code", json={"code": "1383351"})
        fetched = await client.get("/api/v1/me/applicant-code")
        profile = await client.get("/api/v1/me")
        deleted = await client.delete("/api/v1/me/applicant-code")
        admissions = await client.get("/api/v1/me/admissions")

    assert saved.status_code == 200
    assert saved.json()["code"] == "1383351"
    assert fetched.status_code == 200
    assert fetched.json()["code"] == "1383351"
    assert profile.status_code == 200
    assert profile.json()["applicant_code"]["code"] == "1383351"
    assert deleted.status_code == 204
    assert admissions.status_code == 404
    assert admissions.json()["code"] == "APPLICANT_CODE_NOT_SET"


@pytest.mark.asyncio
async def test_applicant_code_rejects_missing_snapshot(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        saved = await client.put("/api/v1/me/applicant-code", json={"code": "1383351"})
        fetched = await client.get("/api/v1/me/applicant-code")

    assert saved.status_code == 503
    assert saved.json()["code"] == "ADMISSIONS_DATA_UNAVAILABLE"
    assert fetched.status_code == 404
    assert fetched.json()["code"] == "APPLICANT_CODE_NOT_SET"


@pytest.mark.asyncio
async def test_applicant_code_rejects_unknown_code_in_latest_snapshot(
    override_db: None,
    db_session: AsyncSession,
) -> None:
    await save_admission_index(db_session, make_index(code="999"))
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        saved = await client.put("/api/v1/me/applicant-code", json={"code": "1383351"})
        fetched = await client.get("/api/v1/me/applicant-code")

    assert saved.status_code == 404
    assert saved.json()["code"] == "APPLICANT_CODE_NOT_FOUND"
    assert saved.json()["details"] == {"service": "spbstu_admissions", "applicant_code": "1383351"}
    assert fetched.status_code == 404
    assert fetched.json()["code"] == "APPLICANT_CODE_NOT_SET"


@pytest.mark.asyncio
async def test_applicant_code_checks_only_latest_snapshot(
    override_db: None,
    db_session: AsyncSession,
) -> None:
    await save_admission_index(db_session, make_index(code="1383351", fetched_offset_minutes=-1))
    await save_admission_index(db_session, make_index(code="999", fetched_offset_minutes=1))
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        saved = await client.put("/api/v1/me/applicant-code", json={"code": "1383351"})
        fetched = await client.get("/api/v1/me/applicant-code")

    assert saved.status_code == 404
    assert saved.json()["code"] == "APPLICANT_CODE_NOT_FOUND"
    assert fetched.status_code == 404
    assert fetched.json()["code"] == "APPLICANT_CODE_NOT_SET"


@pytest.mark.asyncio
async def test_my_admissions_returns_matches_from_latest_snapshot(
    override_db: None,
    db_session: AsyncSession,
) -> None:
    await save_admission_index(db_session, make_index(program_id=657, fetched_offset_minutes=-1))
    await save_admission_index(db_session, make_index(program_id=661, fetched_offset_minutes=1))
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        await client.put("/api/v1/me/applicant-code", json={"code": "1383351"})
        response = await client.get("/api/v1/me/admissions")

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "1383351"
    assert data["source"] == "https://my.spbstu.ru"
    assert data["failed_programs"] == 0
    assert len(data["matches"]) == 1
    assert data["matches"][0] == {
        "program": {
            "id": 661,
            "name": "Program",
            "places": 29,
            "education_form": {"id": "2", "name": "Очная"},
            "admission_condition": {"id": "1", "name": "Бюджетная основа"},
        },
        "priority": 1,
        "score": 99,
        "current_position": 21,
        "agreement_submitted": True,
        "passes_now": True,
    }


@pytest.mark.asyncio
async def test_my_admissions_rejects_missing_snapshot(
    override_db: None,
    db_session: AsyncSession,
) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        user = await create_client_user(db_session, client)
        await set_applicant_code(db_session, user, "1383351")
        await db_session.commit()
        response = await client.get("/api/v1/me/admissions")

    assert response.status_code == 503
    assert response.json()["code"] == "ADMISSIONS_DATA_UNAVAILABLE"


@pytest.mark.asyncio
async def test_my_admissions_returns_empty_matches_for_unknown_code(
    override_db: None,
    db_session: AsyncSession,
) -> None:
    await save_admission_index(db_session, make_index(code="999"))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        user = await create_client_user(db_session, client)
        await set_applicant_code(db_session, user, "1383351")
        await db_session.commit()
        response = await client.get("/api/v1/me/admissions")

    assert response.status_code == 200
    assert response.json()["matches"] == []


@pytest.mark.asyncio
async def test_my_admissions_uses_row_number_for_old_enrolled_snapshots(
    override_db: None,
    db_session: AsyncSession,
) -> None:
    await save_admission_index(db_session, make_enrolled_index())
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        await client.put("/api/v1/me/applicant-code", json={"code": "1824749"})
        response = await client.get("/api/v1/me/admissions")

    assert response.status_code == 200
    assert response.json()["matches"][0]["current_position"] == 20
