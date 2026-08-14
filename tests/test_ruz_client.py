from datetime import date

import httpx
import pytest
import respx

from app.clients.ruz import RuzApiError, RuzClient
from app.clients.ruz import RuzNotFoundError

BASE_URL = "https://ruz.spbstu.ru/api/v1/ruz/"


@pytest.mark.asyncio
@respx.mock
async def test_get_faculties() -> None:
    respx.get(f"{BASE_URL}faculties").mock(
        return_value=httpx.Response(
            200,
            json={
                "faculties": [
                    {"id": 125, "name": "Институт компьютерных наук и кибербезопасности", "abbr": "ИКНК"}
                ]
            },
        )
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        faculties = await RuzClient(http).get_faculties()

    assert len(faculties) == 1
    assert faculties[0].id == 125


@pytest.mark.asyncio
@respx.mock
async def test_get_faculty_groups() -> None:
    respx.get(f"{BASE_URL}faculties/125/groups").mock(
        return_value=httpx.Response(
            200,
            json={
                "faculty": {"id": 125, "name": "ИКНК", "abbr": "ИКНК"},
                "groups": [{"id": 45385, "name": "5130201/60002", "level": 1}],
            },
        )
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        result = await RuzClient(http).get_faculty_groups(125)

    assert result.faculty.id == 125
    assert result.groups[0].name == "5130201/60002"


@pytest.mark.asyncio
@respx.mock
async def test_search_groups_sends_query() -> None:
    route = respx.get(f"{BASE_URL}search/groups").mock(
        return_value=httpx.Response(
            200,
            json={"groups": [{"id": 45476, "name": "5130904/50003", "faculty": {"id": 125, "name": "ИКНК"}}]},
        )
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        groups = await RuzClient(http).search_groups("5130904")

    assert route.called
    assert route.calls.last.request.url.params["q"] == "5130904"
    assert groups[0].id == 45476


@pytest.mark.asyncio
@respx.mock
async def test_search_groups_returns_empty_list_when_ruz_returns_null() -> None:
    respx.get(f"{BASE_URL}search/groups").mock(
        return_value=httpx.Response(200, json={"groups": None})
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        groups = await RuzClient(http).search_groups("несуществующая группа xyz")

    assert groups == []


@pytest.mark.asyncio
@respx.mock
async def test_search_teachers_sends_query() -> None:
    route = respx.get(f"{BASE_URL}search/teachers").mock(
        return_value=httpx.Response(
            200,
            json={
                "teachers": [
                    {
                        "id": 9833,
                        "oid": 31878,
                        "full_name": "Бабенков Валерий Иванович",
                    }
                ]
            },
        )
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        teachers = await RuzClient(http).search_teachers("Бабенков")

    assert route.called
    assert route.calls.last.request.url.params["q"] == "Бабенков"
    assert teachers[0].id == 9833


@pytest.mark.asyncio
@respx.mock
async def test_search_teachers_returns_empty_list_when_ruz_returns_null() -> None:
    respx.get(f"{BASE_URL}search/teachers").mock(
        return_value=httpx.Response(200, json={"teachers": None})
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        teachers = await RuzClient(http).search_teachers("петров алексааа")

    assert teachers == []


@pytest.mark.asyncio
@respx.mock
async def test_get_group_schedule_sends_iso_date() -> None:
    route = respx.get(f"{BASE_URL}scheduler/42828").mock(
        return_value=httpx.Response(
            200,
            json={
                "week": {"date_start": "2026.08.10", "date_end": "2026.08.16", "is_odd": False},
                "group": {"id": 42828, "name": "5130904/20102_2025"},
                "days": [],
            },
        )
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        schedule = await RuzClient(http).get_group_schedule(42828, date(2026, 8, 10))

    assert route.called
    assert route.calls.last.request.url.params["date"] == "2026-08-10"
    assert schedule.group.id == 42828


@pytest.mark.asyncio
@respx.mock
async def test_group_schedule_normalizes_dates_and_moscow_times_to_utc() -> None:
    respx.get(f"{BASE_URL}scheduler/42828").mock(
        return_value=httpx.Response(
            200,
            json={
                "week": {"date_start": "2026.08.10", "date_end": "2026.08.16", "is_odd": False},
                "group": {"id": 42828, "name": "5130904/20102_2025"},
                "days": [
                    {
                        "weekday": 1,
                        "date": "2026.08.10",
                        "lessons": [
                            {
                                "subject": "Математика",
                                "time_start": "14:00",
                                "time_end": "15:40",
                            }
                        ],
                    }
                ],
            },
        )
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        schedule = await RuzClient(http).get_group_schedule(42828)

    assert schedule.model_dump(mode="json")["week"]["date_start"] == "2026-08-10"
    assert schedule.model_dump(mode="json")["week"]["date_end"] == "2026-08-16"
    lesson = schedule.model_dump(mode="json")["days"][0]["lessons"][0]
    assert lesson["time_start"] == "2026-08-10T11:00:00Z"
    assert lesson["time_end"] == "2026-08-10T12:40:00Z"


@pytest.mark.asyncio
@respx.mock
async def test_get_teacher_schedule_sends_iso_date() -> None:
    route = respx.get(f"{BASE_URL}teachers/9833/scheduler").mock(
        return_value=httpx.Response(
            200,
            json={
                "week": {"date_start": "2026.04.13", "date_end": "2026.04.19", "is_odd": True},
                "teacher": {"id": 9833, "full_name": "Бабенков Валерий Иванович"},
                "days": [],
            },
        )
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        schedule = await RuzClient(http).get_teacher_schedule(9833, date(2026, 4, 13))

    assert route.called
    assert route.calls.last.request.url.params["date"] == "2026-04-13"
    assert schedule.teacher.id == 9833


@pytest.mark.asyncio
@respx.mock
async def test_ruz_error_body_raises() -> None:
    respx.get(f"{BASE_URL}scheduler/999999").mock(
        return_value=httpx.Response(200, json={"error": True, "text": "Группа: 999999 не найден"})
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        with pytest.raises(RuzNotFoundError, match="999999"):
            await RuzClient(http).get_group_schedule(999999)


@pytest.mark.asyncio
@respx.mock
async def test_get_teacher() -> None:
    respx.get(f"{BASE_URL}teachers/9833").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": 9833,
                "oid": 31878,
                "full_name": "Бабенков Валерий Иванович",
                "first_name": "Бабенков",
                "middle_name": "Валерий",
                "last_name": "Иванович",
            },
        )
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        teacher = await RuzClient(http).get_teacher(9833)

    assert teacher.id == 9833
    assert teacher.full_name == "Бабенков Валерий Иванович"


@pytest.mark.asyncio
@respx.mock
async def test_missing_teacher_raises_not_found() -> None:
    respx.get(f"{BASE_URL}teachers/999999").mock(
        return_value=httpx.Response(200, json={"error": True, "text": "Преподаватель: 999999 не найден"})
    )

    async with httpx.AsyncClient(base_url=BASE_URL) as http:
        with pytest.raises(RuzNotFoundError, match="999999"):
            await RuzClient(http).get_teacher(999999)
