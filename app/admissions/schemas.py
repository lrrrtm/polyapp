from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ApplicantCodeSet(BaseModel):
    code: str = Field(pattern=r"^\d+$", min_length=1, max_length=32)


class ApplicantCodeProfile(BaseModel):
    code: str
    updated_at: datetime


class AdmissionLookupValue(BaseModel):
    id: str
    name: str


class AdmissionProgramRead(BaseModel):
    id: int
    name: str
    places: int | None
    education_form: AdmissionLookupValue
    admission_condition: AdmissionLookupValue


class AdmissionMatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    program: AdmissionProgramRead
    priority: int | None
    score: int | None
    current_position: int | None
    agreement_submitted: bool
    passes_now: bool


class ApplicantAdmissionsRead(BaseModel):
    code: str
    updated_at: datetime
    source: str
    failed_programs: int
    matches: list[AdmissionMatchRead]
