"""create building map links

Revision ID: 20260814_0002
Revises: 20260814_0001
Create Date: 2026-08-14

"""
from collections.abc import Sequence
from uuid import NAMESPACE_URL, uuid5

from alembic import op
import sqlalchemy as sa

revision: str = "20260814_0002"
down_revision: str | Sequence[str] | None = "20260814_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


BUILDING_MAP_LINKS = [
    (11, "CTcnzS~s"),
    (12, "CTcn742w"),
    (13, "CTcrEENO"),
    (14, "CTcrEUje"),
    (15, "CTcrMS0W"),
    (16, "CTcrIXK-"),
    (17, "CTcn7RNq"),
    (18, "CTcrQM6N"),
    (19, "CTcrQRij"),
    (21, "CTcrUW0y"),
    (23, "CTcrEH5V"),
    (25, "CTcnzPKT"),
    (26, "CTcrAAkx"),
    (28, "CTcrQBMf"),
    (30, "CTcnz6nM"),
    (34, "CTcnzPKT"),
    (36, "CTcrAJiP"),
    (38, "CTcrEW6y"),
    (42, "CTcrI87D"),
    (46, "CTcrAZ5x"),
    (48, "CTcn7H5g"),
    (50, "CTcrMTY3"),
    (51, "CTcrAK24"),
    (54, "CTcrUGPA"),
    (58, "CTcrMM7a"),
    (63, "CTcrI87D"),
    (64, "CTcrI87D"),
    (65, "CTcn7SlT"),
    (69, "CTcrU2jf"),
    (70, "CTcrQ2Z~"),
    (71, "CTcrEENO"),
    (72, "CTcrIG6R"),
    (77, "CTcrIFZN"),
    (81, "CTcrERyU"),
    (86, "CTcnvXiK"),
    (88, "CTcrQD-t"),
]


def upgrade() -> None:
    op.create_table(
        "building_map_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("building_id", sa.Integer(), nullable=False),
        sa.Column("yandex_maps_id", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_building_map_links")),
        sa.UniqueConstraint("building_id", name=op.f("uq_building_map_links_building_id")),
    )
    op.create_index(op.f("ix_building_map_links_building_id"), "building_map_links", ["building_id"], unique=False)

    building_map_links_table = sa.table(
        "building_map_links",
        sa.column("id", sa.Uuid()),
        sa.column("building_id", sa.Integer()),
        sa.column("yandex_maps_id", sa.String()),
    )
    op.bulk_insert(
        building_map_links_table,
        [
            {
                "id": uuid5(NAMESPACE_URL, f"polytech-building-map-link:{building_id}"),
                "building_id": building_id,
                "yandex_maps_id": yandex_maps_id,
            }
            for building_id, yandex_maps_id in BUILDING_MAP_LINKS
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_building_map_links_building_id"), table_name="building_map_links")
    op.drop_table("building_map_links")
