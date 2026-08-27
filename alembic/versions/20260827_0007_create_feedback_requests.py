"""create feedback requests

Revision ID: 20260827_0007
Revises: 20260818_0006
Create Date: 2026-08-27

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260827_0007"
down_revision: str | Sequence[str] | None = "20260818_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "feedback_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("contact", sa.Text(), nullable=False),
        sa.Column("attachment_filename", sa.Text(), nullable=True),
        sa.Column("attachment_content_type", sa.Text(), nullable=True),
        sa.Column("attachment_size", sa.Integer(), nullable=True),
        sa.Column("attachment_data", sa.LargeBinary(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "subject in ('comment', 'question', 'bug', 'feature')",
            name=op.f("ck_feedback_requests_feedback_subject_valid"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_feedback_requests_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_feedback_requests")),
    )
    op.create_index("ix_feedback_requests_user_id", "feedback_requests", ["user_id"], unique=False)
    op.create_index("ix_feedback_requests_created_at", "feedback_requests", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_feedback_requests_created_at", table_name="feedback_requests")
    op.drop_index("ix_feedback_requests_user_id", table_name="feedback_requests")
    op.drop_table("feedback_requests")
