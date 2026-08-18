from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ScheduleChangeEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_type: str
    ruz_id: int
    week_start: date
    detected_at: datetime
    changes: list[dict]
