from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.buildings.models import BuildingMapLink


async def list_building_map_links(db: AsyncSession) -> list[BuildingMapLink]:
    result = await db.scalars(select(BuildingMapLink).order_by(BuildingMapLink.building_id))
    return list(result)
