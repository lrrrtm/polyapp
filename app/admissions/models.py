from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON, Uuid

from app.db.base import Base


class AdmissionSnapshot(Base):
    __tablename__ = "admission_snapshots"
    __table_args__ = (Index("ix_admission_snapshots_fetched_at", "fetched_at"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    failed_programs: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    total_programs: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    matches: Mapped[list["AdmissionMatch"]] = relationship(
        back_populates="snapshot",
        cascade="all, delete-orphan",
    )


class AdmissionMatch(Base):
    __tablename__ = "admission_matches"
    __table_args__ = (
        Index("ix_admission_matches_snapshot_applicant", "snapshot_id", "applicant_code"),
        Index("ix_admission_matches_snapshot_id", "snapshot_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    snapshot_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("admission_snapshots.id", ondelete="CASCADE"),
        nullable=False,
    )
    applicant_code: Mapped[str] = mapped_column(Text, nullable=False)
    level: Mapped[str] = mapped_column(Text, nullable=False)
    form: Mapped[str] = mapped_column(Text, nullable=False)
    condition: Mapped[str] = mapped_column(Text, nullable=False)
    program_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    program_title: Mapped[str] = mapped_column(Text, nullable=False)
    places: Mapped[int | None] = mapped_column(Integer)
    applications: Mapped[int | None] = mapped_column(Integer)
    date_info: Mapped[str | None] = mapped_column(Text)
    row: Mapped[dict] = mapped_column(JSON, nullable=False)
    passing_position: Mapped[int | None] = mapped_column(Integer)
    passing_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    technical_position: Mapped[int | None] = mapped_column(Integer)
    current_position: Mapped[int | None] = mapped_column(Integer)
    passes_now: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    technically_passes: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    snapshot: Mapped[AdmissionSnapshot] = relationship(back_populates="matches")


class UserApplicantProfile(Base):
    __tablename__ = "user_applicant_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_applicant_profiles_user_id"),)

    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    applicant_code: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
