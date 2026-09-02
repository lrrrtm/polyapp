from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_ruz_client
from app.api.errors import ApiError, ApiErrorCode, problem_responses
from app.clients.ruz import RuzApiError, RuzClient, RuzNotFoundError
from app.core.config import get_settings
from app.db.session import get_db
from app.users.deps import get_current_user, get_or_create_current_user, hash_identity_token
from app.users.models import ScheduleItemType, User
from app.users.schemas import (
    FavoriteCreate,
    PrimaryGroupSet,
    ScheduleItemNotificationsUpdate,
    SessionStatus,
    UserProfile,
    UserScheduleItemRead,
)
from app.users.service import (
    add_schedule_item,
    delete_schedule_item,
    get_profile,
    get_user_by_identity_hash,
    set_primary_group,
    update_schedule_item_notifications,
)

router = APIRouter(tags=["users"])


@router.get("/session", response_model=SessionStatus)
async def read_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SessionStatus:
    settings = get_settings()
    token = request.cookies.get(settings.user_cookie_name)
    if not token:
        return SessionStatus(has_user=False)

    user = await get_user_by_identity_hash(db, hash_identity_token(token))
    return SessionStatus(has_user=user is not None)


@router.get("/me", response_model=UserProfile, responses=problem_responses(status.HTTP_404_NOT_FOUND))
async def read_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    return await get_profile(db, user)


@router.post("/me", response_model=UserProfile)
async def create_me(
    user: User = Depends(get_or_create_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    return await get_profile(db, user)


@router.put(
    "/me/primary-group",
    response_model=UserProfile,
    responses=problem_responses(status.HTTP_404_NOT_FOUND, status.HTTP_502_BAD_GATEWAY),
)
async def update_primary_group(
    payload: PrimaryGroupSet,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ruz: RuzClient = Depends(get_ruz_client),
) -> UserProfile:
    await validate_group_id(ruz, payload.ruz_id)
    await set_primary_group(db, user, payload.ruz_id)
    return await get_profile(db, user)


@router.get("/me/favorites", response_model=list[UserScheduleItemRead])
async def read_favorites(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserScheduleItemRead]:
    profile = await get_profile(db, user)
    return profile.favorites


@router.post(
    "/me/favorites",
    response_model=UserScheduleItemRead,
    responses=problem_responses(status.HTTP_404_NOT_FOUND, status.HTTP_502_BAD_GATEWAY),
)
async def create_favorite(
    payload: FavoriteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ruz: RuzClient = Depends(get_ruz_client),
) -> UserScheduleItemRead:
    await validate_schedule_item_id(ruz, payload.item_type, payload.ruz_id)
    item = await add_schedule_item(db, user, payload.item_type, payload.ruz_id)
    return UserScheduleItemRead.model_validate(item)


@router.delete(
    "/me/favorites/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=problem_responses(status.HTTP_404_NOT_FOUND),
)
async def remove_favorite(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    deleted = await delete_schedule_item(db, user, item_id)
    if not deleted:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code=ApiErrorCode.FAVORITE_NOT_FOUND,
            title="Favorite not found",
            message="Избранное не найдено.",
            details={"favorite_id": str(item_id)},
        )


@router.patch(
    "/me/schedule-items/{item_id}/notifications",
    response_model=UserScheduleItemRead,
    responses=problem_responses(status.HTTP_404_NOT_FOUND),
)
async def update_schedule_item_notification_settings(
    item_id: UUID,
    payload: ScheduleItemNotificationsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserScheduleItemRead:
    item = await update_schedule_item_notifications(db, user, item_id, payload.notifications_enabled)
    if item is None:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code=ApiErrorCode.SCHEDULE_ITEM_NOT_FOUND,
            title="Schedule item not found",
            message="Расписание не найдено.",
            details={"item_id": str(item_id)},
        )
    return UserScheduleItemRead.model_validate(item)


async def validate_schedule_item_id(
    ruz: RuzClient,
    item_type: ScheduleItemType,
    ruz_id: int,
) -> None:
    if item_type == ScheduleItemType.GROUP:
        await validate_group_id(ruz, ruz_id)
        return

    await validate_teacher_id(ruz, ruz_id)


async def validate_group_id(ruz: RuzClient, group_id: int) -> None:
    try:
        await ruz.ensure_group_exists(group_id)
    except RuzNotFoundError as error:
        raise ruz_not_found_error("group", group_id) from error
    except RuzApiError as error:
        raise ruz_upstream_error("group", group_id) from error


async def validate_teacher_id(ruz: RuzClient, teacher_id: int) -> None:
    try:
        await ruz.ensure_teacher_exists(teacher_id)
    except RuzNotFoundError as error:
        raise ruz_not_found_error("teacher", teacher_id) from error
    except RuzApiError as error:
        raise ruz_upstream_error("teacher", teacher_id) from error


def ruz_not_found_error(resource: str, ruz_id: int) -> ApiError:
    if resource == "group":
        return ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code=ApiErrorCode.RUZ_GROUP_NOT_FOUND,
            title="Group not found",
            message="Группа не найдена в расписании Политеха.",
            details={"service": "ruz", "resource": resource, "ruz_id": ruz_id},
        )

    return ApiError(
        status_code=status.HTTP_404_NOT_FOUND,
        code=ApiErrorCode.RUZ_TEACHER_NOT_FOUND,
        title="Teacher not found",
        message="Преподаватель не найден в расписании Политеха.",
        details={"service": "ruz", "resource": resource, "ruz_id": ruz_id},
    )


def ruz_upstream_error(resource: str, ruz_id: int) -> ApiError:
    return ApiError(
        status_code=status.HTTP_502_BAD_GATEWAY,
        code=ApiErrorCode.RUZ_UPSTREAM_ERROR,
        title="Schedule service unavailable",
        message="Сервис расписания временно недоступен. Попробуйте позже.",
        details={"service": "ruz", "resource": resource, "ruz_id": ruz_id},
    )
