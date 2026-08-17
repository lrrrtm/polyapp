from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.users.models import ScheduleItemType


class UserModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PrimaryGroupSet(BaseModel):
    ruz_id: int = Field(gt=0)


class FavoriteCreate(BaseModel):
    item_type: ScheduleItemType
    ruz_id: int = Field(gt=0)


class UserScheduleItemRead(UserModel):
    id: UUID
    item_type: ScheduleItemType
    ruz_id: int
    is_primary: bool
    created_at: datetime


class UserApplicantCodeRead(BaseModel):
    code: str
    updated_at: datetime


class UserProfile(UserModel):
    id: UUID
    primary_group: UserScheduleItemRead | None
    favorites: list[UserScheduleItemRead]
    applicant_code: UserApplicantCodeRead | None


class SessionStatus(BaseModel):
    has_user: bool
