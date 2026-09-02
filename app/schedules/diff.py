from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from typing import Any

from app.schemas.ruz import GroupSchedule


LESSON_FIELDS = (
    "date",
    "time_start",
    "time_end",
    "subject",
    "type",
    "type_name",
    "groups",
    "teachers",
    "auditories",
    "webinar_url",
    "lms_url",
)


def schedule_payload(schedule: GroupSchedule) -> dict[str, Any]:
    return schedule.model_dump(mode="json", by_alias=True, exclude_none=True, exclude={"meta"})


def schedule_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def diff_schedules(old_payload: dict[str, Any], new_payload: dict[str, Any]) -> list[dict[str, Any]]:
    old_lessons = _lessons_by_key(old_payload)
    new_lessons = _lessons_by_key(new_payload)
    changes: list[dict[str, Any]] = []

    matched_old = set(old_lessons) & set(new_lessons)
    for key in sorted(matched_old):
        before = old_lessons[key]
        after = new_lessons[key]
        fields = _changed_fields(before, after)
        if fields:
            changes.append({"type": "lesson_updated", "before": before, "after": after, "fields": fields})

    removed = {key: old_lessons[key] for key in set(old_lessons) - matched_old}
    added = {key: new_lessons[key] for key in set(new_lessons) - matched_old}

    for old_key, new_key in _match_soft_updates(removed, added):
        before = removed.pop(old_key)
        after = added.pop(new_key)
        changes.append({"type": "lesson_updated", "before": before, "after": after, "fields": _changed_fields(before, after)})

    for lesson in sorted(removed.values(), key=_lesson_sort_key):
        changes.append({"type": "lesson_removed", "lesson": lesson})
    for lesson in sorted(added.values(), key=_lesson_sort_key):
        changes.append({"type": "lesson_added", "lesson": lesson})

    return changes


def _lessons_by_key(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    lessons: dict[str, dict[str, Any]] = {}
    counts: dict[str, int] = defaultdict(int)
    for day in payload.get("days", []):
        for lesson in day.get("lessons", []):
            normalized = _normalize_lesson(day.get("date", ""), lesson)
            base_key = "|".join(
                [
                    str(normalized["date"]),
                    str(normalized["time_start"]),
                    str(normalized["time_end"]),
                    str(normalized["subject"]),
                    str(normalized["type"]),
                ]
            )
            counts[base_key] += 1
            lessons[f"{base_key}|{counts[base_key]}"] = normalized
    return lessons


def _normalize_lesson(day_date: str, lesson: dict[str, Any]) -> dict[str, Any]:
    type_obj = lesson.get("typeObj") or {}
    return {
        "date": day_date,
        "time_start": lesson.get("time_start"),
        "time_end": lesson.get("time_end"),
        "subject": lesson.get("subject") or "",
        "type": lesson.get("type"),
        "type_name": type_obj.get("name") or type_obj.get("abbr") or "",
        "groups": _normalize_entities(lesson.get("groups") or [], "name"),
        "teachers": _normalize_entities(lesson.get("teachers") or [], "full_name"),
        "auditories": _normalize_auditories(lesson.get("auditories") or []),
        "webinar_url": lesson.get("webinar_url") or "",
        "lms_url": lesson.get("lms_url") or "",
    }


def _normalize_entities(items: list[dict[str, Any]], name_field: str) -> list[dict[str, Any]]:
    return sorted(
        [{"id": item.get("id"), "name": item.get(name_field) or item.get("name") or ""} for item in items],
        key=lambda item: (item["id"] is None, item["id"] or 0, item["name"]),
    )


def _normalize_auditories(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        [
            {
                "id": item.get("id"),
                "name": item.get("name") or "",
                "building_id": (item.get("building") or {}).get("id"),
                "building_name": (item.get("building") or {}).get("name") or "",
            }
            for item in items
        ],
        key=lambda item: (item["id"] is None, item["id"] or 0, item["name"], item["building_id"] or 0),
    )


def _changed_fields(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    return [field for field in LESSON_FIELDS if before.get(field) != after.get(field)]


def _match_soft_updates(
    removed: dict[str, dict[str, Any]],
    added: dict[str, dict[str, Any]],
) -> list[tuple[str, str]]:
    removed_by_soft_key = _group_by_soft_key(removed)
    added_by_soft_key = _group_by_soft_key(added)
    matches = []
    for key in sorted(set(removed_by_soft_key) & set(added_by_soft_key)):
        old_keys = removed_by_soft_key[key]
        new_keys = added_by_soft_key[key]
        if len(old_keys) == 1 and len(new_keys) == 1:
            matches.append((old_keys[0], new_keys[0]))
    return matches


def _group_by_soft_key(lessons: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for key, lesson in lessons.items():
        grouped[f"{lesson['date']}|{lesson['subject']}|{lesson['type']}"].append(key)
    return grouped


def _lesson_sort_key(lesson: dict[str, Any]) -> tuple[str, str, str]:
    return (lesson["date"], lesson["time_start"] or "", lesson["subject"])
