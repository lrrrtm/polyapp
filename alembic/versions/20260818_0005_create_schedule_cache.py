"""create schedule cache

Revision ID: 20260818_0005
Revises: 20260817_0004
Create Date: 2026-08-18

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260818_0005"
down_revision: str | Sequence[str] | None = "20260817_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "schedule_cache",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_type", sa.Text(), nullable=False),
        sa.Column("ruz_id", sa.BigInteger(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("payload_hash", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_refresh_failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_schedule_cache")),
        sa.UniqueConstraint("item_type", "ruz_id", "week_start", name="uq_schedule_cache_item_week"),
    )
    op.create_index("ix_schedule_cache_item", "schedule_cache", ["item_type", "ruz_id"], unique=False)

    op.create_table(
        "schedule_change_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_type", sa.Text(), nullable=False),
        sa.Column("ruz_id", sa.BigInteger(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("old_hash", sa.Text(), nullable=False),
        sa.Column("new_hash", sa.Text(), nullable=False),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_schedule_change_events")),
    )
    op.create_index(
        "ix_schedule_change_events_item_detected",
        "schedule_change_events",
        ["item_type", "ruz_id", "detected_at"],
        unique=False,
    )
    op.create_index(
        "ix_schedule_change_events_week_start",
        "schedule_change_events",
        ["week_start"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_schedule_change_events_week_start", table_name="schedule_change_events")
    op.drop_index("ix_schedule_change_events_item_detected", table_name="schedule_change_events")
    op.drop_table("schedule_change_events")
    op.drop_index("ix_schedule_cache_item", table_name="schedule_cache")
    op.drop_table("schedule_cache")
