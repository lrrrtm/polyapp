from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.buildings.schemas import BuildingMapLinkRead
from app.buildings.service import list_building_map_links
from app.db.session import get_db

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.get("/map-links", response_model=list[BuildingMapLinkRead])
async def read_building_map_links(db: AsyncSession = Depends(get_db)) -> list[BuildingMapLinkRead]:
    return await list_building_map_links(db)
