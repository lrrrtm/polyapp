import asyncio

from app.admissions.indexer import build_index, build_program_matches


class FakeAdmissionsClient:
    async def get_code_list(self, level: str, form: str, condition: str) -> list[dict]:
        if level == "master_pre_competition_lists" and form == "2" and condition == "1":
            return [{"id": 657, "title": "Program"}]
        return []

    async def get_applicant_list(self, level: str, form: str, condition: str, program_id: int) -> list[dict]:
        return [{"num": 1, "code": "1383351", "comment_status": "К зачислению"}]

    async def get_direction_info(self, level: str, program_id: int, condition: str) -> dict:
        return {"places": 1, "applications": 1, "date_info": "13.08.2026 20:00"}


class PartlyFailingAdmissionsClient(FakeAdmissionsClient):
    async def get_code_list(self, level: str, form: str, condition: str) -> list[dict]:
        if level == "master_pre_competition_lists" and form == "2" and condition == "1":
            return [{"id": 657, "title": "Good"}, {"id": 999, "title": "Bad"}]
        return []

    async def get_applicant_list(self, level: str, form: str, condition: str, program_id: int) -> list[dict]:
        if program_id == 999:
            raise ConnectionError("boom")
        return await super().get_applicant_list(level, form, condition, program_id)


def test_build_index_for_all_levels() -> None:
    index = asyncio.run(build_index(FakeAdmissionsClient(), concurrency=2))

    assert index["total_programs"] == 1
    assert index["matches"][0]["applicant_code"] == "1383351"
    assert index["matches"][0]["program_id"] == 657


def test_build_index_keeps_partial_result_when_program_fails() -> None:
    index = asyncio.run(build_index(PartlyFailingAdmissionsClient(), concurrency=2))

    assert index["failed_programs"] == 1
    assert [match["program_id"] for match in index["matches"]] == [657]


def test_passing_position_counts_only_passing_rows() -> None:
    matches = build_program_matches(
        level="master_pre_competition_lists",
        form="2",
        condition="1",
        program={"id": 657, "title": "Program"},
        info={"places": 2, "applications": 3, "date_info": "13.08.2026 20:00"},
        rows=[
            {"num": 1, "code": "111", "comment_status": "Участвует в конкурсе"},
            {"num": 2, "code": "222", "comment_status": "К зачислению"},
            {"num": 3, "code": "333", "comment_status": "К зачислению"},
        ],
    )

    match = next(match for match in matches if match["applicant_code"] == "333")
    assert match["passing_position"] == 2
    assert match["technical_position"] == 2
    assert match["current_position"] == 2
    assert match["passing_total"] == 2
    assert match["passes_now"] is True
    assert match["technically_passes"] is True


def test_enrolled_status_counts_as_passing_position() -> None:
    matches = build_program_matches(
        level="bachelor_competition_lists",
        form="2",
        condition="1",
        program={"id": 649, "title": "Program"},
        info={"places": 80},
        rows=[
            {"num": 18, "code": "111", "comment_status": "Зачислен"},
            {"num": 19, "code": "222", "comment_status": "Зачислен"},
            {"num": 20, "code": "333", "comment_status": "Зачислен"},
        ],
    )

    match = next(match for match in matches if match["applicant_code"] == "333")
    assert match["passing_position"] == 3
    assert match["technical_position"] == 3
    assert match["current_position"] == 3
    assert match["passes_now"] is True


def test_other_priority_does_not_pass_now() -> None:
    matches = build_program_matches(
        level="master_pre_competition_lists",
        form="2",
        condition="1",
        program={"id": 659, "title": "Program"},
        info={"places": 10},
        rows=[
            {"num": 1, "code": "222", "sum": 99, "sum_vs": 94, "counl_ind": 5, "comment_status": "К зачислению по другому приоритету"},
            {"num": 2, "code": "111", "sum": 90, "sum_vs": 90, "counl_ind": 0, "comment_status": "К зачислению"},
        ],
    )

    match = next(match for match in matches if match["applicant_code"] == "222")
    assert match["passing_position"] is None
    assert match["technical_position"] == 1
    assert match["current_position"] == 1
    assert match["passes_now"] is False
    assert match["technically_passes"] is True


def test_current_position_excludes_competing_rows() -> None:
    matches = build_program_matches(
        level="master_pre_competition_lists",
        form="2",
        condition="1",
        program={"id": 659, "title": "Program"},
        info={"places": 10},
        rows=[
            {"num": 1, "code": "111", "comment_status": "Участвует в конкурсе"},
            {"num": 2, "code": "222", "sum": 99, "sum_vs": 94, "counl_ind": 5, "comment_status": "К зачислению по другому приоритету"},
            {"num": 3, "code": "333", "sum": 90, "sum_vs": 90, "counl_ind": 0, "comment_status": "К зачислению"},
        ],
    )

    assert next(match for match in matches if match["applicant_code"] == "111")["current_position"] is None
    assert next(match for match in matches if match["applicant_code"] == "222")["current_position"] == 1
    assert next(match for match in matches if match["applicant_code"] == "333")["current_position"] == 1


def test_other_priority_position_is_ranked_by_scores() -> None:
    matches = build_program_matches(
        level="master_pre_competition_lists",
        form="2",
        condition="1",
        program={"id": 661, "title": "Program"},
        info={"places": 10},
        rows=[
            {"code": "111", "sum": 110, "sum_vs": 100, "counl_ind": 10, "comment_status": "К зачислению"},
            {"code": "222", "sum": 90, "sum_vs": 90, "counl_ind": 0, "comment_status": "К зачислению"},
            {
                "code": "333",
                "sum": 99,
                "sum_vs": 94,
                "counl_ind": 5,
                "comment_status": "К зачислению по другому приоритету",
            },
        ],
    )

    match = next(match for match in matches if match["applicant_code"] == "333")
    assert match["technical_position"] == 3
    assert match["current_position"] == 2


def test_missing_code_is_absent() -> None:
    matches = build_program_matches(
        level="master_pre_competition_lists",
        form="2",
        condition="1",
        program={"id": 657, "title": "Program"},
        info={},
        rows=[{"num": 1, "code": "111", "comment_status": "К зачислению"}, {"num": 2}],
    )

    assert [match["applicant_code"] for match in matches] == ["111"]
