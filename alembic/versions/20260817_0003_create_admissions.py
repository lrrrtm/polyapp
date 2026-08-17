"""create admissions

Revision ID: 20260817_0003
Revises: 20260814_0002
Create Date: 2026-08-17

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260817_0003"
down_revision: str | Sequence[str] | None = "20260814_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "admission_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("failed_programs", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_programs", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_rows", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admission_snapshots")),
    )
    op.create_index("ix_admission_snapshots_fetched_at", "admission_snapshots", ["fetched_at"], unique=False)

    op.create_table(
        "admission_matches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("snapshot_id", sa.Uuid(), nullable=False),
        sa.Column("applicant_code", sa.Text(), nullable=False),
        sa.Column("level", sa.Text(), nullable=False),
        sa.Column("form", sa.Text(), nullable=False),
        sa.Column("condition", sa.Text(), nullable=False),
        sa.Column("program_id", sa.BigInteger(), nullable=False),
        sa.Column("program_title", sa.Text(), nullable=False),
        sa.Column("places", sa.Integer(), nullable=True),
        sa.Column("applications", sa.Integer(), nullable=True),
        sa.Column("date_info", sa.Text(), nullable=True),
        sa.Column("row", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("passing_position", sa.Integer(), nullable=True),
        sa.Column("passing_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("technical_position", sa.Integer(), nullable=True),
        sa.Column("current_position", sa.Integer(), nullable=True),
        sa.Column("passes_now", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("technically_passes", sa.Boolean(), server_default="false", nullable=False),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["admission_snapshots.id"],
            name=op.f("fk_admission_matches_snapshot_id_admission_snapshots"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admission_matches")),
    )
    op.create_index(
        "ix_admission_matches_snapshot_applicant",
        "admission_matches",
        ["snapshot_id", "applicant_code"],
        unique=False,
    )
    op.create_index("ix_admission_matches_snapshot_id", "admission_matches", ["snapshot_id"], unique=False)

    op.create_table(
        "user_applicant_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("applicant_code", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_user_applicant_profiles_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_user_applicant_profiles")),
        sa.UniqueConstraint("user_id", name="uq_user_applicant_profiles_user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_applicant_profiles")
    op.drop_index("ix_admission_matches_snapshot_id", table_name="admission_matches")
    op.drop_index("ix_admission_matches_snapshot_applicant", table_name="admission_matches")
    op.drop_table("admission_matches")
    op.drop_index("ix_admission_snapshots_fetched_at", table_name="admission_snapshots")
    op.drop_table("admission_snapshots")
