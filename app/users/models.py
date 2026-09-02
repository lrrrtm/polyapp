from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.db.base import Base


class ScheduleItemType(StrEnum):
    GROUP = "group"
    TEACHER = "teacher"


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    identity_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    schedule_items: Mapped[list["UserScheduleItem"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserScheduleItem(Base):
    __tablename__ = "user_schedule_items"
    __table_args__ = (
        CheckConstraint("item_type in ('group', 'teacher')", name="item_type_valid"),
        CheckConstraint("not is_primary or item_type = 'group'", name="primary_item_is_group"),
        UniqueConstraint("user_id", "item_type", "ruz_id", name="uq_user_schedule_items_user_item"),
        Index("ix_user_schedule_items_user_id", "user_id"),
        Index(
            "ux_user_schedule_items_primary_group",
            "user_id",
            unique=True,
            postgresql_where=text("is_primary"),
            sqlite_where=text("is_primary"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    item_type: Mapped[str] = mapped_column(Text, nullable=False)
    ruz_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    is_primary: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="false")
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="schedule_items")
