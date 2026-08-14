"""create users

Revision ID: 20260814_0001
Revises:
Create Date: 2026-08-14

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260814_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("identity_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("identity_hash", name=op.f("uq_users_identity_hash")),
    )
    op.create_table(
        "user_schedule_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("item_type", sa.Text(), nullable=False),
        sa.Column("ruz_id", sa.BigInteger(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("item_type in ('group', 'teacher')", name=op.f("ck_user_schedule_items_item_type_valid")),
        sa.CheckConstraint("not is_primary or item_type = 'group'", name=op.f("ck_user_schedule_items_primary_item_is_group")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_user_schedule_items_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_schedule_items")),
        sa.UniqueConstraint("user_id", "item_type", "ruz_id", name="uq_user_schedule_items_user_item"),
    )
    op.create_index("ix_user_schedule_items_user_id", "user_schedule_items", ["user_id"])
    op.create_index(
        "ux_user_schedule_items_primary_group",
        "user_schedule_items",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_primary"),
    )


def downgrade() -> None:
    op.drop_index("ux_user_schedule_items_primary_group", table_name="user_schedule_items", postgresql_where=sa.text("is_primary"))
    op.drop_index("ix_user_schedule_items_user_id", table_name="user_schedule_items")
    op.drop_table("user_schedule_items")
    op.drop_table("users")

