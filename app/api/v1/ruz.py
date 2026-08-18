from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_ruz_client
from app.api.errors import ApiError, ApiErrorCode, problem_responses
from app.api.v1.mock_schedules import get_mock_group_schedule
from app.clients.ruz import RuzApiError, RuzClient, RuzNotFoundError
from app.db.session import get_db
from app.schemas.ruz import Faculty, FacultyGroups, Group, GroupSchedule, Teacher, TeacherSchedule
from app.schedules.service import get_group_schedule_cached_or_live

router = APIRouter(tags=["ruz"])


def ruz_upstream_error() -> ApiError:
    return ApiError(
        status_code=status.HTTP_502_BAD_GATEWAY,
        code=ApiErrorCode.RUZ_UPSTREAM_ERROR,
        title="Schedule service unavailable",
        message="Сервис расписания временно недоступен. Попробуйте позже.",
        details={"service": "ruz"},
    )


def ruz_resource_not_found(resource: str, ruz_id: int) -> ApiError:
    return ApiError(
        status_code=status.HTTP_404_NOT_FOUND,
        code=ApiErrorCode.RUZ_RESOURCE_NOT_FOUND,
        title="Schedule resource not found",
        message="Запрошенные данные не найдены в расписании Политеха.",
        details={"service": "ruz", "resource": resource, "ruz_id": ruz_id},
    )


def ruz_teacher_not_found(teacher_id: int) -> ApiError:
    return ApiError(
        status_code=status.HTTP_404_NOT_FOUND,
        code=ApiErrorCode.RUZ_TEACHER_NOT_FOUND,
        title="Teacher not found",
        message="Преподаватель не найден в расписании Политеха.",
        details={"service": "ruz", "resource": "teacher", "ruz_id": teacher_id},
    )


@router.get(
    "/faculties",
    response_model=list[Faculty],
    responses=problem_responses(status.HTTP_502_BAD_GATEWAY),
)
async def get_faculties(
    ruz: RuzClient = Depends(get_ruz_client),
) -> list[Faculty]:
    try:
        return await ruz.get_faculties()
    except RuzApiError as error:
        raise ruz_upstream_error() from error


@router.get(
    "/faculties/{faculty_id}/groups",
    response_model=FacultyGroups,
    responses=problem_responses(status.HTTP_404_NOT_FOUND, status.HTTP_502_BAD_GATEWAY),
)
async def get_faculty_groups(
    faculty_id: int,
    ruz: RuzClient = Depends(get_ruz_client),
) -> FacultyGroups:
    try:
        return await ruz.get_faculty_groups(faculty_id)
    except RuzNotFoundError as error:
        raise ruz_resource_not_found("faculty", faculty_id) from error
    except RuzApiError as error:
        raise ruz_upstream_error() from error


@router.get(
    "/groups/search",
    response_model=list[Group],
    responses=problem_responses(status.HTTP_502_BAD_GATEWAY),
)
async def search_groups(
    q: str = Query(min_length=1),
    ruz: RuzClient = Depends(get_ruz_client),
) -> list[Group]:
    try:
        return await ruz.search_groups(q)
    except RuzApiError as error:
        raise ruz_upstream_error() from error


@router.get(
    "/groups/{group_id}/schedule",
    response_model=GroupSchedule,
    responses=problem_responses(status.HTTP_404_NOT_FOUND, status.HTTP_502_BAD_GATEWAY),
)
async def get_group_schedule(
    group_id: int,
    schedule_date: date | None = Query(default=None, alias="date"),
    ruz: RuzClient = Depends(get_ruz_client),
    db: AsyncSession = Depends(get_db),
) -> GroupSchedule:
    mock_schedule = get_mock_group_schedule(group_id, schedule_date)
    if mock_schedule:
        return mock_schedule

    try:
        return await get_group_schedule_cached_or_live(db, ruz, group_id, schedule_date)
    except RuzNotFoundError as error:
        raise ruz_resource_not_found("group", group_id) from error
    except RuzApiError as error:
        raise ruz_upstream_error() from error


@router.get(
    "/teachers/search",
    response_model=list[Teacher],
    responses=problem_responses(status.HTTP_502_BAD_GATEWAY),
)
async def search_teachers(
    q: str = Query(min_length=1),
    ruz: RuzClient = Depends(get_ruz_client),
) -> list[Teacher]:
    try:
        return await ruz.search_teachers(q)
    except RuzApiError as error:
        raise ruz_upstream_error() from error


@router.get(
    "/teachers/{teacher_id}/schedule",
    response_model=TeacherSchedule,
    responses=problem_responses(status.HTTP_404_NOT_FOUND, status.HTTP_502_BAD_GATEWAY),
)
async def get_teacher_schedule(
    teacher_id: int,
    schedule_date: date | None = Query(default=None, alias="date"),
    ruz: RuzClient = Depends(get_ruz_client),
) -> TeacherSchedule:
    try:
        return await ruz.get_teacher_schedule(teacher_id, schedule_date)
    except RuzNotFoundError as error:
        raise ruz_teacher_not_found(teacher_id) from error
    except RuzApiError as error:
        raise ruz_upstream_error() from error
