from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Protocol


logger = logging.getLogger(__name__)
SOURCE = "https://my.spbstu.ru"
PASSING_STATUS = "К зачислению"
ENROLLED_STATUS = "Зачислен"
PASSING_STATUSES = {PASSING_STATUS, ENROLLED_STATUS}

LEVELS = {
    "bachelor_competition_lists": {
        "forms": ("1", "2", "3"),
        "conditions": ("1", "2", "3", "4", "6"),
    },
    "master_pre_competition_lists": {
        "forms": ("1", "2", "3"),
        "conditions": ("1", "2", "3", "4", "6"),
    },
    "spo_competition_lists": {
        "forms": ("1", "2", "3"),
        "conditions": ("1", "2"),
    },
}


class AdmissionsSourceClient(Protocol):
    async def get_code_list(self, level: str, form: str, condition: str) -> list[dict[str, Any]]: ...

    async def get_direction_info(self, level: str, program_id: int, condition: str) -> dict[str, Any]: ...

    async def get_applicant_list(
        self,
        level: str,
        form: str,
        condition: str,
        program_id: int,
    ) -> list[dict[str, Any]]: ...


def build_program_matches(
    *,
    level: str,
    form: str,
    condition: str,
    program: dict[str, Any],
    info: dict[str, Any],
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    places = _int_or_none(info.get("places"))
    passing_rows = [row for row in rows if row.get("comment_status") in PASSING_STATUSES]
    passing_positions = {
        row.get("code"): index
        for index, row in enumerate(passing_rows, start=1)
        if row.get("code")
    }
    seen_passing = 0
    technical_positions: dict[str, int] = {}
    for row in rows:
        code = row.get("code")
        if not code:
            continue
        if row.get("comment_status") in PASSING_STATUSES:
            seen_passing += 1
            technical_positions[code] = seen_passing
        else:
            technical_positions[code] = seen_passing + 1

    matches: list[dict[str, Any]] = []
    for row in rows:
        code = row.get("code")
        if not code:
            continue
        passing_position = passing_positions.get(code)
        technical_position = technical_positions.get(code)
        current_position = _current_position(row, passing_rows, passing_position)
        matches.append(
            {
                "applicant_code": str(code),
                "level": level,
                "form": form,
                "condition": condition,
                "program_id": int(program["id"]),
                "program_title": program["title"],
                "places": places,
                "applications": _int_or_none(info.get("applications")),
                "date_info": info.get("date_info"),
                "row": row,
                "passing_position": passing_position,
                "passing_total": len(passing_rows),
                "technical_position": technical_position,
                "current_position": current_position,
                "technically_passes": (
                    technical_position is not None
                    and places is not None
                    and technical_position <= places
                ),
                "passes_now": (
                    row.get("comment_status") in PASSING_STATUSES
                    and passing_position is not None
                    and places is not None
                    and passing_position <= places
                ),
            }
        )
    return matches


def _current_position(
    row: dict[str, Any],
    passing_rows: list[dict[str, Any]],
    passing_position: int | None,
) -> int | None:
    status = row.get("comment_status")
    if status in PASSING_STATUSES:
        return passing_position
    if status == "Участвует в конкурсе":
        return None

    target_key = _ranking_key(row)
    return 1 + sum(_ranking_key(passing_row) <= target_key for passing_row in passing_rows)


def _ranking_key(row: dict[str, Any]) -> tuple[int, int, int]:
    return (
        -(_int_or_none(row.get("sum")) or 0),
        -(_int_or_none(row.get("sum_vs")) or 0),
        -(_int_or_none(row.get("counl_ind")) or 0),
    )


async def build_index(
    client: AdmissionsSourceClient,
    *,
    source: str = SOURCE,
    concurrency: int = 5,
) -> dict[str, Any]:
    started_at = datetime.now(timezone.utc)
    jobs: list[tuple[str, str, str, dict[str, Any]]] = []

    for level, config in LEVELS.items():
        logger.info("Loading SPbSTU admission level=%s", level)
        for form in config["forms"]:
            for condition in config["conditions"]:
                programs = await client.get_code_list(level, form, condition)
                jobs.extend((level, form, condition, program) for program in programs)

    semaphore = asyncio.Semaphore(concurrency)
    results = await asyncio.gather(*(_load_program(client, semaphore, job) for job in jobs))

    matches: list[dict[str, Any]] = []
    total_rows = 0
    failed_programs = 0
    for program_matches, rows_count, failed in results:
        matches.extend(program_matches)
        total_rows += rows_count
        failed_programs += failed

    finished_at = datetime.now(timezone.utc)
    return {
        "source": source,
        "started_at": started_at,
        "finished_at": finished_at,
        "fetched_at": finished_at,
        "failed_programs": failed_programs,
        "total_programs": len(jobs),
        "total_rows": total_rows,
        "matches": matches,
    }


async def _load_program(
    client: AdmissionsSourceClient,
    semaphore: asyncio.Semaphore,
    job: tuple[str, str, str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], int, int]:
    level, form, condition, program = job
    program_id = int(program["id"])
    async with semaphore:
        try:
            rows, info = await asyncio.gather(
                client.get_applicant_list(level, form, condition, program_id),
                client.get_direction_info(level, program_id, condition),
            )
        except Exception:
            logger.exception(
                "Failed admission program level=%s form=%s condition=%s program_id=%s",
                level,
                form,
                condition,
                program_id,
            )
            return [], 0, 1

    return (
        build_program_matches(
            level=level,
            form=form,
            condition=condition,
            program={"id": program_id, "title": program["title"]},
            info=info,
            rows=rows,
        ),
        len(rows),
        0,
    )


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
