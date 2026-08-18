"""create telegram notifications

Revision ID: 20260818_0006
Revises: 20260818_0005
Create Date: 2026-08-18

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260818_0006"
down_revision: str | Sequence[str] | None = "20260818_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "telegram_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("telegram_user_id", sa.BigInteger(), nullable=False),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=False),
        sa.Column("telegram_username", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("linked_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_telegram_accounts_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_telegram_accounts")),
        sa.UniqueConstraint("telegram_user_id", name="uq_telegram_accounts_telegram_user_id"),
        sa.UniqueConstraint("user_id", name="uq_telegram_accounts_user_id"),
    )
    op.create_index("ix_telegram_accounts_chat_id", "telegram_accounts", ["telegram_chat_id"], unique=False)

    op.create_table(
        "telegram_link_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_telegram_link_tokens_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_telegram_link_tokens")),
        sa.UniqueConstraint("token", name="uq_telegram_link_tokens_token"),
    )
    op.create_index("ix_telegram_link_tokens_user_id", "telegram_link_tokens", ["user_id"], unique=False)

    op.create_table(
        "user_notification_settings",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("schedule_changes_enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("lesson_added_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("lesson_removed_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("time_changed_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("auditorium_changed_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("teacher_changed_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_user_notification_settings_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_user_notification_settings")),
    )

    op.create_table(
        "notification_outbox",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("source_event_id", sa.Uuid(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("dedupe_key", sa.Text(), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("channel in ('telegram')", name=op.f("ck_notification_outbox_notification_channel_valid")),
        sa.CheckConstraint(
            "status in ('pending', 'processing', 'sent', 'failed', 'cancelled')",
            name=op.f("ck_notification_outbox_notification_status_valid"),
        ),
        sa.ForeignKeyConstraint(["source_event_id"], ["schedule_change_events.id"], name=op.f("fk_notification_outbox_source_event_id_schedule_change_events"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_notification_outbox_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification_outbox")),
        sa.UniqueConstraint("dedupe_key", name="uq_notification_outbox_dedupe_key"),
    )
    op.create_index("ix_notification_outbox_due", "notification_outbox", ["status", "next_attempt_at"], unique=False)
    op.create_index("ix_notification_outbox_user_id", "notification_outbox", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notification_outbox_user_id", table_name="notification_outbox")
    op.drop_index("ix_notification_outbox_due", table_name="notification_outbox")
    op.drop_table("notification_outbox")
    op.drop_table("user_notification_settings")
    op.drop_index("ix_telegram_link_tokens_user_id", table_name="telegram_link_tokens")
    op.drop_table("telegram_link_tokens")
    op.drop_index("ix_telegram_accounts_chat_id", table_name="telegram_accounts")
    op.drop_table("telegram_accounts")
