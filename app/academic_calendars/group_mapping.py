from dataclasses import dataclass
import re


@dataclass(frozen=True)
class AcademicCalendarKey:
    direction_code: str
    level: int
    admission_year: int


GROUP_RE = re.compile(r"^\D*(\d{2})([34])(\d{4})/(\d)(\d{2})(\d{2})\D*$")


def parse_group_academic_calendar_key(group_name: str) -> AcademicCalendarKey | None:
    match = GROUP_RE.match(group_name.strip())
    if not match:
        return None

    _institute, level, direction_start, admission_year_digit, _profile, _subgroup = match.groups()
    admission_year = 2020 + int(admission_year_digit)
    level_number = int(level)
    return AcademicCalendarKey(
        direction_code=f"{direction_start[:2]}.{level_number:02d}.{direction_start[2:]}",
        level=level_number,
        admission_year=admission_year,
    )
