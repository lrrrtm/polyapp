from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schedules.schemas import ScheduleChangeEventRead
from app.schedules.service import list_user_schedule_changes
from app.users.deps import get_current_user
from app.users.models import User

router = APIRouter(prefix="/me", tags=["schedules"])


@router.get("/schedule-changes", response_model=list[ScheduleChangeEventRead])
async def read_my_schedule_changes(
    since: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ScheduleChangeEventRead]:
    events = await list_user_schedule_changes(db, user, since=since, limit=limit)
    return [ScheduleChangeEventRead.model_validate(event) for event in events]
