"""add schedule item notification toggle

Revision ID: 20260902_0009
Revises: 20260828_0008
Create Date: 2026-09-02

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260902_0009"
down_revision: str | Sequence[str] | None = "20260828_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_schedule_items",
        sa.Column("notifications_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.execute("update user_schedule_items set notifications_enabled = true where is_primary")


def downgrade() -> None:
    op.drop_column("user_schedule_items", "notifications_enabled")
