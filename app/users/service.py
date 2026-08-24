from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.admissions.service import get_applicant_profile
from app.core.config import get_settings
from app.users.models import ScheduleItemType, User, UserScheduleItem
from app.users.schemas import UserApplicantCodeRead, UserProfile, UserScheduleItemRead


async def get_user_by_identity_hash(db: AsyncSession, identity_hash: str) -> User | None:
    result = await db.execute(select(User).where(User.identity_hash == identity_hash))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, identity_hash: str) -> User:
    user = User(identity_hash=identity_hash)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def touch_user(user: User) -> None:
    user.last_seen_at = datetime.now(UTC)


async def list_schedule_items(db: AsyncSession, user: User) -> list[UserScheduleItem]:
    result = await db.execute(
        select(UserScheduleItem)
        .where(UserScheduleItem.user_id == user.id)
        .order_by(UserScheduleItem.is_primary.desc(), UserScheduleItem.created_at.asc())
    )
    return list(result.scalars())


async def get_profile(db: AsyncSession, user: User) -> UserProfile:
    items = await list_schedule_items(db, user)
    primary_group = next((item for item in items if item.is_primary), None)
    favorites = [item for item in items if not item.is_primary]
    applicant_profile = await get_applicant_profile(db, user) if get_settings().admissions_enabled else None
    return UserProfile(
        id=user.id,
        primary_group=UserScheduleItemRead.model_validate(primary_group) if primary_group else None,
        favorites=[UserScheduleItemRead.model_validate(item) for item in favorites],
        applicant_code=(
            UserApplicantCodeRead(code=applicant_profile.applicant_code, updated_at=applicant_profile.updated_at)
            if applicant_profile
            else None
        ),
    )


async def add_schedule_item(
    db: AsyncSession,
    user: User,
    item_type: ScheduleItemType,
    ruz_id: int,
) -> UserScheduleItem:
    existing = await _get_schedule_item(db, user, item_type, ruz_id)
    if existing is not None:
        return existing

    item = UserScheduleItem(user_id=user.id, item_type=item_type.value, ruz_id=ruz_id)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def set_primary_group(db: AsyncSession, user: User, ruz_id: int) -> UserScheduleItem:
    await db.execute(
        update(UserScheduleItem)
        .where(UserScheduleItem.user_id == user.id, UserScheduleItem.is_primary.is_(True))
        .values(is_primary=False)
    )

    item = await _get_schedule_item(db, user, ScheduleItemType.GROUP, ruz_id)
    if item is None:
        item = UserScheduleItem(
            user_id=user.id,
            item_type=ScheduleItemType.GROUP.value,
            ruz_id=ruz_id,
            is_primary=True,
        )
        db.add(item)
    else:
        item.is_primary = True

    await db.flush()
    await db.refresh(item)
    return item


async def delete_schedule_item(db: AsyncSession, user: User, item_id: UUID) -> bool:
    result = await db.execute(
        select(UserScheduleItem).where(
            UserScheduleItem.id == item_id,
            UserScheduleItem.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        return False

    await db.delete(item)
    await db.flush()
    return True


async def _get_schedule_item(
    db: AsyncSession,
    user: User,
    item_type: ScheduleItemType,
    ruz_id: int,
) -> UserScheduleItem | None:
    result = await db.execute(
        select(UserScheduleItem).where(
            UserScheduleItem.user_id == user.id,
            UserScheduleItem.item_type == item_type.value,
            UserScheduleItem.ruz_id == ruz_id,
        )
    )
    return result.scalar_one_or_none()
