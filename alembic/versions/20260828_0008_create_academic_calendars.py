"""create academic calendars

Revision ID: 20260828_0008
Revises: 20260827_0007
Create Date: 2026-08-28

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260828_0008"
down_revision: str | Sequence[str] | None = "20260827_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "academic_calendars",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("direction_code", sa.Text(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("admission_year", sa.Integer(), nullable=False),
        sa.Column("education_form", sa.Text(), nullable=False),
        sa.Column("source_program_code", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("education_form in ('full_time')", name=op.f("ck_academic_calendars_academic_calendar_form_valid")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academic_calendars")),
        sa.UniqueConstraint("direction_code", "level", "admission_year", "education_form", name="uq_academic_calendars_key"),
    )
    op.create_index(
        "ix_academic_calendars_key",
        "academic_calendars",
        ["direction_code", "level", "admission_year", "education_form"],
        unique=False,
    )

    op.create_table(
        "academic_calendar_days",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("calendar_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("period_type", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "period_type in ('theory', 'exam', 'practice', 'diploma', 'vacation', 'pre_diploma_practice', 'holiday')",
            name=op.f("ck_academic_calendar_days_academic_period_type_valid"),
        ),
        sa.ForeignKeyConstraint(["calendar_id"], ["academic_calendars.id"], name=op.f("fk_academic_calendar_days_calendar_id_academic_calendars"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academic_calendar_days")),
        sa.UniqueConstraint("calendar_id", "date", "period_type", name="uq_academic_calendar_days_calendar_date_type"),
    )
    op.create_index(
        "ix_academic_calendar_days_calendar_date",
        "academic_calendar_days",
        ["calendar_id", "date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_academic_calendar_days_calendar_date", table_name="academic_calendar_days")
    op.drop_table("academic_calendar_days")
    op.drop_index("ix_academic_calendars_key", table_name="academic_calendars")
    op.drop_table("academic_calendars")
