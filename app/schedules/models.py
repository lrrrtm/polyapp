from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Date, DateTime, Index, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.db.base import Base


class ScheduleCache(Base):
    __tablename__ = "schedule_cache"
    __table_args__ = (
        UniqueConstraint("item_type", "ruz_id", "week_start", name="uq_schedule_cache_item_week"),
        Index("ix_schedule_cache_item", "item_type", "ruz_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    item_type: Mapped[str] = mapped_column(Text, nullable=False)
    ruz_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    payload_hash: Mapped[str] = mapped_column(Text, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_refresh_failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ScheduleChangeEvent(Base):
    __tablename__ = "schedule_change_events"
    __table_args__ = (
        Index("ix_schedule_change_events_item_detected", "item_type", "ruz_id", "detected_at"),
        Index("ix_schedule_change_events_week_start", "week_start"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    item_type: Mapped[str] = mapped_column(Text, nullable=False)
    ruz_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    old_hash: Mapped[str] = mapped_column(Text, nullable=False)
    new_hash: Mapped[str] = mapped_column(Text, nullable=False)
    changes: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
