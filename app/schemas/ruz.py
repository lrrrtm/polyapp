from datetime import date, datetime, time, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MOSCOW_TZ = ZoneInfo("Europe/Moscow")


def parse_ruz_date(value: date | str) -> date:
    if isinstance(value, date):
        return value

    return date.fromisoformat(value.replace(".", "-"))


def to_utc_datetime(day: date, value: datetime | str | None) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=MOSCOW_TZ)
        return value.astimezone(timezone.utc)

    if "T" in value:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=MOSCOW_TZ)
        return parsed.astimezone(timezone.utc)

    lesson_time = time.fromisoformat(value)
    return datetime.combine(day, lesson_time, tzinfo=MOSCOW_TZ).astimezone(timezone.utc)


class RuzModel(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class Faculty(RuzModel):
    id: int
    name: str
    abbr: str = ""


class Group(RuzModel):
    id: int
    name: str
    level: int | None = None
    type: str | None = None
    kind: int | None = None
    spec: str = ""
    year: int | None = None
    faculty: Faculty | None = None


class FacultyGroups(RuzModel):
    faculty: Faculty
    groups: list[Group]


class Teacher(RuzModel):
    id: int
    oid: int | None = None
    full_name: str
    first_name: str = ""
    middle_name: str = ""
    last_name: str = ""
    grade: str = ""
    chair: str = ""


class Building(RuzModel):
    id: int
    name: str
    abbr: str = ""
    address: str = ""


class Auditorium(RuzModel):
    id: int
    name: str
    building: Building


class LessonType(RuzModel):
    id: int | None = None
    name: str = ""
    abbr: str = ""


class Lesson(RuzModel):
    subject: str = ""
    subject_short: str = ""
    type: int | None = None
    additional_info: str = ""
    time_start: datetime | None = None
    time_end: datetime | None = None
    type_obj: LessonType | None = Field(default=None, alias="typeObj")
    parity: int | None = None
    groups: list[Group] = Field(default_factory=list)
    teachers: list[Teacher] = Field(default_factory=list)
    auditories: list[Auditorium] = Field(default_factory=list)
    webinar_url: str = ""
    lms_url: str = ""

    @model_validator(mode="before")
    @classmethod
    def normalize_nullable_lists(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data

        data = data.copy()
        for field in ("groups", "teachers", "auditories"):
            if data.get(field) is None:
                data[field] = []
        return data


class Day(RuzModel):
    weekday: int
    date: date
    lessons: list[Lesson] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_lesson_times(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data

        day_date = parse_ruz_date(data["date"])
        data = data.copy()
        data["date"] = day_date
        lessons = data.get("lessons") or []
        data["lessons"] = [
            {
                **lesson,
                "time_start": to_utc_datetime(day_date, lesson.get("time_start")),
                "time_end": to_utc_datetime(day_date, lesson.get("time_end")),
            }
            if isinstance(lesson, dict)
            else lesson
            for lesson in lessons
        ]
        return data


class Week(RuzModel):
    date_start: date
    date_end: date
    is_odd: bool

    @field_validator("date_start", "date_end", mode="before")
    @classmethod
    def normalize_date(cls, value: date | str) -> date:
        return parse_ruz_date(value)


class ScheduleMeta(RuzModel):
    source: Literal["live", "cache"]
    is_stale: bool = False
    fetched_at: datetime | None = None
    failed_refresh_at: datetime | None = None


class GroupSchedule(RuzModel):
    week: Week
    group: Group
    days: list[Day] = Field(default_factory=list)
    meta: ScheduleMeta | None = None


class TeacherSchedule(RuzModel):
    week: Week
    teacher: Teacher
    days: list[Day] = Field(default_factory=list)
