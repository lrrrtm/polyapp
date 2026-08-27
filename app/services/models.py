from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, LargeBinary, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.db.base import Base


class FeedbackSubject(StrEnum):
    COMMENT = "comment"
    QUESTION = "question"
    BUG = "bug"
    FEATURE = "feature"


class FeedbackRequest(Base):
    __tablename__ = "feedback_requests"
    __table_args__ = (
        CheckConstraint("subject in ('comment', 'question', 'bug', 'feature')", name="feedback_subject_valid"),
        Index("ix_feedback_requests_user_id", "user_id"),
        Index("ix_feedback_requests_created_at", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    contact: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_filename: Mapped[str | None] = mapped_column(Text)
    attachment_content_type: Mapped[str | None] = mapped_column(Text)
    attachment_size: Mapped[int | None] = mapped_column(Integer)
    attachment_data: Mapped[bytes | None] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
