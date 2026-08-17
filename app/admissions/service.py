from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.admissions.client import SpbstuAdmissionsClient
from app.admissions.indexer import build_index
from app.admissions.models import AdmissionMatch, AdmissionSnapshot, UserApplicantProfile
from app.admissions.schemas import AdmissionLookupValue, AdmissionMatchRead, AdmissionProgramRead
from app.api.errors import ApiError, ApiErrorCode
from app.core.config import Settings
from app.users.models import User


ADMISSIONS_REFRESH_LOCK_ID = 2026081701
EDUCATION_FORMS = {
    "1": "Заочная",
    "2": "Очная",
    "3": "Очно-заочная",
}
ADMISSION_CONDITIONS = {
    "1": "Бюджетная основа",
    "2": "Контракт",
    "3": "Особое право",
    "4": "Отдельная квота",
    "5": "Целевой приём",
}
PASSING_STATUSES = {"К зачислению", "Зачислен"}


async def set_applicant_code(db: AsyncSession, user: User, code: str) -> UserApplicantProfile:
    profile = await get_applicant_profile(db, user)
    if profile:
        profile.applicant_code = code
        await db.flush()
        await db.refresh(profile)
        return profile

    profile = UserApplicantProfile(user_id=user.id, applicant_code=code)
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return profile


async def delete_applicant_code(db: AsyncSession, user: User) -> bool:
    result = await db.execute(delete(UserApplicantProfile).where(UserApplicantProfile.user_id == user.id))
    return result.rowcount > 0


async def get_applicant_profile(db: AsyncSession, user: User) -> UserApplicantProfile | None:
    return await db.scalar(select(UserApplicantProfile).where(UserApplicantProfile.user_id == user.id))


async def get_latest_snapshot(db: AsyncSession) -> AdmissionSnapshot | None:
    return await db.scalar(select(AdmissionSnapshot).order_by(AdmissionSnapshot.fetched_at.desc()).limit(1))


async def require_latest_snapshot(db: AsyncSession) -> AdmissionSnapshot:
    snapshot = await get_latest_snapshot(db)
    if snapshot is None:
        raise ApiError(
            status_code=503,
            code=ApiErrorCode.ADMISSIONS_DATA_UNAVAILABLE,
            title="Admissions data unavailable",
            message="Данные конкурсных списков пока недоступны. Попробуйте позже.",
            details={"service": "spbstu_admissions"},
        )
    return snapshot


async def applicant_code_exists(
    db: AsyncSession,
    *,
    snapshot_id: UUID,
    code: str,
) -> bool:
    return bool(
        await db.scalar(
            select(exists().where(AdmissionMatch.snapshot_id == snapshot_id, AdmissionMatch.applicant_code == code))
        )
    )


async def get_matches_for_code(
    db: AsyncSession,
    *,
    snapshot_id: UUID,
    code: str,
) -> list[AdmissionMatch]:
    result = await db.scalars(
        select(AdmissionMatch)
        .where(AdmissionMatch.snapshot_id == snapshot_id, AdmissionMatch.applicant_code == code)
        .order_by(AdmissionMatch.level, AdmissionMatch.form, AdmissionMatch.condition, AdmissionMatch.program_id)
    )
    return list(result)


def admission_match_read(match: AdmissionMatch) -> AdmissionMatchRead:
    return AdmissionMatchRead(
        program=AdmissionProgramRead(
            id=match.program_id,
            name=match.program_title,
            places=match.places,
            education_form=AdmissionLookupValue(
                id=match.form,
                name=EDUCATION_FORMS.get(match.form, f"Форма {match.form}"),
            ),
            admission_condition=AdmissionLookupValue(
                id=match.condition,
                name=ADMISSION_CONDITIONS.get(match.condition, f"Условие {match.condition}"),
            ),
        ),
        priority=_int_or_none(match.row.get("priority")),
        score=_int_or_none(match.row.get("sum")),
        current_position=_current_position(match),
        agreement_submitted=match.row.get("agreement") == "Получено",
        passes_now=match.row.get("highest_passing_priority") == "Да",
    )


def _current_position(match: AdmissionMatch) -> int | None:
    if match.passing_position:
        return match.passing_position
    if match.row.get("comment_status") in PASSING_STATUSES:
        return _int_or_none(match.row.get("num"))
    return match.technical_position or match.current_position


def _int_or_none(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


async def save_admission_index(db: AsyncSession, index: dict) -> AdmissionSnapshot:
    snapshot = AdmissionSnapshot(
        source=index["source"],
        fetched_at=index["fetched_at"],
        started_at=index["started_at"],
        finished_at=index["finished_at"],
        failed_programs=index["failed_programs"],
        total_programs=index["total_programs"],
        total_rows=index["total_rows"],
    )
    db.add(snapshot)
    await db.flush()

    db.add_all(
        AdmissionMatch(snapshot_id=snapshot.id, **match)
        for match in index["matches"]
    )
    await db.flush()
    await prune_old_snapshots(db)
    return snapshot


async def prune_old_snapshots(db: AsyncSession, *, keep: int = 3) -> None:
    old_ids = (
        await db.scalars(
            select(AdmissionSnapshot.id)
            .order_by(AdmissionSnapshot.fetched_at.desc())
            .offset(keep)
        )
    ).all()
    if old_ids:
        await db.execute(delete(AdmissionSnapshot).where(AdmissionSnapshot.id.in_(old_ids)))


async def refresh_admissions(
    *,
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    in_process_lock,
) -> bool:
    async with in_process_lock:
        async with SpbstuAdmissionsClient(
            base_url=settings.spbstu_base_url,
            timeout=settings.spbstu_timeout,
            sessionid=settings.spbstu_sessionid,
        ) as client:
            index = await build_index(
                client,
                source=settings.spbstu_base_url.rstrip("/"),
                concurrency=settings.spbstu_concurrency,
            )

        async with session_factory() as db:
            lock_acquired = await _try_advisory_lock(db)
            if not lock_acquired:
                return False
            try:
                await save_admission_index(db, index)
                await db.commit()
                return True
            except Exception:
                await db.rollback()
                raise


async def _try_advisory_lock(db: AsyncSession) -> bool:
    if db.bind and db.bind.dialect.name != "postgresql":
        return True
    return bool(await db.scalar(select(func.pg_try_advisory_xact_lock(ADMISSIONS_REFRESH_LOCK_ID))))
