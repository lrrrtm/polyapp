from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.db.base import Base


class AcademicCalendarForm(StrEnum):
    FULL_TIME = "full_time"


class AcademicPeriodType(StrEnum):
    THEORY = "theory"
    EXAM = "exam"
    PRACTICE = "practice"
    DIPLOMA = "diploma"
    VACATION = "vacation"
    PRE_DIPLOMA_PRACTICE = "pre_diploma_practice"
    HOLIDAY = "holiday"


class AcademicCalendar(Base):
    __tablename__ = "academic_calendars"
    __table_args__ = (
        CheckConstraint("education_form in ('full_time')", name="academic_calendar_form_valid"),
        UniqueConstraint(
            "direction_code",
            "level",
            "admission_year",
            "education_form",
            name="uq_academic_calendars_key",
        ),
        Index("ix_academic_calendars_key", "direction_code", "level", "admission_year", "education_form"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    direction_code: Mapped[str] = mapped_column(Text, nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    admission_year: Mapped[int] = mapped_column(Integer, nullable=False)
    education_form: Mapped[str] = mapped_column(Text, nullable=False)
    source_program_code: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    days: Mapped[list["AcademicCalendarDay"]] = relationship(
        back_populates="calendar",
        cascade="all, delete-orphan",
    )


class AcademicCalendarDay(Base):
    __tablename__ = "academic_calendar_days"
    __table_args__ = (
        CheckConstraint(
            "period_type in ('theory', 'exam', 'practice', 'diploma', 'vacation', 'pre_diploma_practice', 'holiday')",
            name="academic_period_type_valid",
        ),
        UniqueConstraint("calendar_id", "date", "period_type", name="uq_academic_calendar_days_calendar_date_type"),
        Index("ix_academic_calendar_days_calendar_date", "calendar_id", "date"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    calendar_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("academic_calendars.id", ondelete="CASCADE"),
        nullable=False,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    period_type: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    calendar: Mapped[AcademicCalendar] = relationship(back_populates="days")
