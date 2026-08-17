from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.admissions.schemas import (
    ApplicantAdmissionsRead,
    ApplicantCodeProfile,
    ApplicantCodeSet,
)
from app.admissions.service import (
    admission_match_read,
    applicant_code_exists,
    delete_applicant_code,
    get_applicant_profile,
    get_matches_for_code,
    require_latest_snapshot,
    set_applicant_code,
)
from app.api.errors import ApiError, ApiErrorCode, problem_responses
from app.db.session import get_db
from app.users.deps import get_current_user
from app.users.models import User

router = APIRouter(prefix="/me", tags=["admissions"])


@router.get(
    "/applicant-code",
    response_model=ApplicantCodeProfile,
    responses=problem_responses(status.HTTP_404_NOT_FOUND),
)
async def read_applicant_code(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicantCodeProfile:
    profile = await get_applicant_profile(db, user)
    if not profile:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code=ApiErrorCode.APPLICANT_CODE_NOT_SET,
            title="Applicant code is not set",
            message="Код поступающего ещё не сохранён.",
        )

    return ApplicantCodeProfile(code=profile.applicant_code, updated_at=profile.updated_at)


@router.put(
    "/applicant-code",
    response_model=ApplicantCodeProfile,
    responses=problem_responses(status.HTTP_404_NOT_FOUND, status.HTTP_503_SERVICE_UNAVAILABLE),
)
async def update_applicant_code(
    payload: ApplicantCodeSet,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicantCodeProfile:
    snapshot = await require_latest_snapshot(db)
    if not await applicant_code_exists(db, snapshot_id=snapshot.id, code=payload.code):
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code=ApiErrorCode.APPLICANT_CODE_NOT_FOUND,
            title="Applicant code not found",
            message="Код поступающего не найден в конкурсных списках.",
            details={"service": "spbstu_admissions", "applicant_code": payload.code},
        )

    profile = await set_applicant_code(db, user, payload.code)
    return ApplicantCodeProfile(code=profile.applicant_code, updated_at=profile.updated_at)


@router.delete("/applicant-code", status_code=status.HTTP_204_NO_CONTENT)
async def remove_applicant_code(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_applicant_code(db, user)


@router.get(
    "/admissions",
    response_model=ApplicantAdmissionsRead,
    responses=problem_responses(status.HTTP_404_NOT_FOUND, status.HTTP_503_SERVICE_UNAVAILABLE),
)
async def read_my_admissions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicantAdmissionsRead:
    profile = await get_applicant_profile(db, user)
    if not profile:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code=ApiErrorCode.APPLICANT_CODE_NOT_SET,
            title="Applicant code is not set",
            message="Код поступающего ещё не сохранён.",
        )

    snapshot = await require_latest_snapshot(db)
    matches = await get_matches_for_code(db, snapshot_id=snapshot.id, code=profile.applicant_code)
    return ApplicantAdmissionsRead(
        code=profile.applicant_code,
        updated_at=snapshot.fetched_at,
        source=snapshot.source,
        failed_programs=snapshot.failed_programs,
        matches=[admission_match_read(match) for match in matches],
    )
