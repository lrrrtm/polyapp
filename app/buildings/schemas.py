from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field


class BuildingMapLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    building_id: int
    yandex_maps_id: str

    @computed_field
    @property
    def yandex_maps_url(self) -> str:
        return f"https://yandex.ru/maps/-/{self.yandex_maps_id}"
