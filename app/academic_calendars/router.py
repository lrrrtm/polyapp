from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.academic_calendars.schemas import AcademicPeriodRangeRead, AcademicPeriodRead, CurrentAcademicCalendarRead
from app.academic_calendars.service import get_current_academic_calendar, moscow_today
from app.api.errors import ApiError, ApiErrorCode, problem_responses
from app.db.session import get_db
from app.users.deps import get_current_user
from app.users.models import User

router = APIRouter(prefix="/me/academic-calendar", tags=["academic-calendar"])


@router.get(
    "/current",
    response_model=CurrentAcademicCalendarRead,
    responses=problem_responses(status.HTTP_404_NOT_FOUND),
)
async def read_current_academic_calendar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CurrentAcademicCalendarRead:
    current = await get_current_academic_calendar(db, user, moscow_today())
    if current is None:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code=ApiErrorCode.ACADEMIC_CALENDAR_NOT_FOUND,
            title="Academic calendar not found",
            message="Календарный учебный график для группы не найден.",
        )

    group_name, calendar, current_periods, next_period, periods = current
    return CurrentAcademicCalendarRead(
        group_name=group_name,
        direction_code=calendar.direction_code,
        level=calendar.level,
        admission_year=calendar.admission_year,
        source_url=calendar.source_url,
        current_periods=[AcademicPeriodRead(date=period.date, period_type=period.period_type) for period in current_periods],
        next_period=AcademicPeriodRead(date=next_period.date, period_type=next_period.period_type) if next_period else None,
        periods=[
            AcademicPeriodRangeRead(start_date=period.start_date, end_date=period.end_date, period_type=period.period_type)
            for period in periods
        ],
    )
