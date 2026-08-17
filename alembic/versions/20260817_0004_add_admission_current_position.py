"""add admission current position

Revision ID: 20260817_0004
Revises: 20260817_0003
Create Date: 2026-08-17

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260817_0004"
down_revision: str | Sequence[str] | None = "20260817_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("admission_matches", sa.Column("current_position", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("admission_matches", "current_position")
