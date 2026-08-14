from datetime import date
from typing import Any

import httpx
from pydantic import ValidationError

from app.schemas.ruz import Faculty, FacultyGroups, Group, GroupSchedule, Teacher, TeacherSchedule


class RuzApiError(Exception):
    pass


class RuzNotFoundError(RuzApiError):
    pass


class RuzClient:
    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http

    async def _get(self, path: str, **params: Any) -> dict[str, Any]:
        clean_params = {key: value for key, value in params.items() if value is not None}

        try:
            response = await self._http.get(path, params=clean_params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as error:
            raise RuzApiError(f"RUZ request failed: {error}") from error
        except ValueError as error:
            raise RuzApiError("RUZ returned invalid JSON") from error

        if not isinstance(data, dict):
            raise RuzApiError("RUZ returned unexpected response")

        if data.get("error"):
            raise RuzNotFoundError(str(data.get("text") or "RUZ API error"))

        return data

    async def get_faculties(self) -> list[Faculty]:
        data = await self._get("faculties")
        try:
            return [Faculty.model_validate(item) for item in data["faculties"]]
        except (KeyError, TypeError, ValidationError) as error:
            raise RuzApiError("RUZ returned invalid faculties payload") from error

    async def get_faculty_groups(self, faculty_id: int) -> FacultyGroups:
        data = await self._get(f"faculties/{faculty_id}/groups")
        try:
            return FacultyGroups.model_validate(data)
        except ValidationError as error:
            raise RuzApiError("RUZ returned invalid faculty groups payload") from error

    async def search_groups(self, query: str) -> list[Group]:
        data = await self._get("search/groups", q=query)
        try:
            return [Group.model_validate(item) for item in data["groups"] or []]
        except (KeyError, TypeError, ValidationError) as error:
            raise RuzApiError("RUZ returned invalid group search payload") from error

    async def search_teachers(self, query: str) -> list[Teacher]:
        data = await self._get("search/teachers", q=query)
        try:
            return [Teacher.model_validate(item) for item in data["teachers"] or []]
        except (KeyError, TypeError, ValidationError) as error:
            raise RuzApiError("RUZ returned invalid teacher search payload") from error

    async def get_group_schedule(
        self,
        group_id: int,
        schedule_date: date | None = None,
    ) -> GroupSchedule:
        data = await self._get(
            f"scheduler/{group_id}",
            date=schedule_date.isoformat() if schedule_date else None,
        )
        try:
            return GroupSchedule.model_validate(data)
        except ValidationError as error:
            raise RuzApiError("RUZ returned invalid group schedule payload") from error

    async def get_teacher(self, teacher_id: int) -> Teacher:
        data = await self._get(f"teachers/{teacher_id}")
        try:
            return Teacher.model_validate(data)
        except ValidationError as error:
            raise RuzApiError("RUZ returned invalid teacher payload") from error

    async def get_teacher_schedule(
        self,
        teacher_id: int,
        schedule_date: date | None = None,
    ) -> TeacherSchedule:
        data = await self._get(
            f"teachers/{teacher_id}/scheduler",
            date=schedule_date.isoformat() if schedule_date else None,
        )
        try:
            return TeacherSchedule.model_validate(data)
        except ValidationError as error:
            raise RuzApiError("RUZ returned invalid teacher schedule payload") from error

    async def ensure_group_exists(self, group_id: int) -> None:
        await self.get_group_schedule(group_id)

    async def ensure_teacher_exists(self, teacher_id: int) -> None:
        await self.get_teacher(teacher_id)
