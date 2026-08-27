from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DormitoryPaymentLookupRequest(BaseModel):
    contract: str = Field(min_length=1, max_length=100)

    @field_validator("contract")
    @classmethod
    def strip_contract(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Contract is required")
        return value


class DormitoryPaymentPay(BaseModel):
    name: str | None = None
    type: str | None = None
    sum: float


class DormitoryPaymentLookupResponse(BaseModel):
    valid: bool
    contract: str | None = None
    payer_name: str | None = None
    base: str | None = None
    recipient: str | None = None
    department: str | None = None
    account: str | None = None
    additional: str | None = None
    amount_due: float | None = None
    pays: list[DormitoryPaymentPay] = Field(default_factory=list)
    data_date: str | None = None


class FeedbackSubmissionResponse(BaseModel):
    id: UUID
    created_at: datetime
