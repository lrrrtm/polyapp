from datetime import date

from pydantic import BaseModel


class AcademicPeriodRead(BaseModel):
    date: date
    period_type: str


class AcademicPeriodRangeRead(BaseModel):
    start_date: date
    end_date: date
    period_type: str


class CurrentAcademicCalendarRead(BaseModel):
    group_name: str
    direction_code: str
    level: int
    admission_year: int
    current_periods: list[AcademicPeriodRead]
    next_period: AcademicPeriodRead | None
    periods: list[AcademicPeriodRangeRead]
