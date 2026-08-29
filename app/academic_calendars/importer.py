from __future__ import annotations

import asyncio
from collections.abc import Iterable
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
import os
import re
from time import perf_counter
from urllib.parse import urljoin
from zipfile import ZipFile
from io import BytesIO

import httpx
import ssl
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
import truststore

from app.academic_calendars.models import AcademicCalendar, AcademicCalendarDay, AcademicCalendarForm
from app.academic_calendars.pdf_parser import ParsedAcademicCalendarDay, parse_academic_calendar_pdf
from app.core.config import get_settings
from app.db.session import SessionLocal

SOURCE_URL = "https://www.spbstu.ru/sveden/education/documents-educational-process-educational-organization/"
ADMISSION_YEAR_RE = re.compile(r"прием\s+(\d{4})\s+года")
PROGRAM_CODE_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{2})_(\d{2})")


@dataclass(frozen=True)
class CalendarImportCandidate:
    source_program_code: str
    direction_code: str
    level: int
    admission_year: int
    education_form: str
    source_url: str


@dataclass(frozen=True)
class CalendarImportResult:
    candidate: CalendarImportCandidate
    days: list[ParsedAcademicCalendarDay]
    source_updated_at: datetime | None
    download_seconds: float
    parse_seconds: float


class EducationScheduleParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self.rows: list[dict[str, object]] = []
        self._row: dict[str, object] | None = None
        self._cell: dict[str, object] | None = None
        self._cell_text: list[str] = []
        self._current_link: str | None = None
        self._current_link_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "tr":
            self._row = {"links": []}
        elif tag == "td" and self._row is not None:
            self._cell = {"itemprop": attrs_dict.get("itemprop"), "links": []}
            self._cell_text = []
        elif tag == "a" and self._cell is not None:
            href = attrs_dict.get("href")
            self._current_link = urljoin(self.base_url, href) if href else None
            self._current_link_text = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell_text.append(data)
        if self._current_link is not None:
            self._current_link_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._cell is not None and self._current_link:
            links = self._cell["links"]
            assert isinstance(links, list)
            links.append((self._current_link, clean_text("".join(self._current_link_text))))
            self._current_link = None
            self._current_link_text = []
        elif tag == "td" and self._row is not None and self._cell is not None:
            itemprop = self._cell.get("itemprop")
            text = clean_text("".join(self._cell_text))
            if itemprop:
                self._row[str(itemprop)] = text
                self._row[f"{itemprop}_links"] = self._cell["links"]
            self._cell = None
            self._cell_text = []
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None


def clean_text(value: str) -> str:
    return " ".join(value.split())


def parse_calendar_candidates(html: str, base_url: str = SOURCE_URL) -> list[CalendarImportCandidate]:
    parser = EducationScheduleParser(base_url)
    parser.feed(html)
    candidates = []
    seen: set[tuple[str, int, int, str]] = set()
    for row in parser.rows:
        if row.get("eduForm") != "Очная":
            continue
        edu_prof = str(row.get("eduProf") or "")
        match = PROGRAM_CODE_RE.search(edu_prof)
        if not match:
            continue
        source_program_code = match.group(0)
        direction_code = ".".join(match.groups()[:3])
        level = int(match.group(2))
        for href, label in row.get("educationShedule_links", []):  # type: ignore[union-attr]
            if "calendar_" not in href:
                continue
            year_match = ADMISSION_YEAR_RE.search(str(label))
            if not year_match:
                continue
            admission_year = int(year_match.group(1))
            key = (direction_code, level, admission_year, AcademicCalendarForm.FULL_TIME.value)
            if key in seen:
                continue
            seen.add(key)
            candidates.append(
                CalendarImportCandidate(
                    source_program_code=source_program_code,
                    direction_code=direction_code,
                    level=level,
                    admission_year=admission_year,
                    education_form=AcademicCalendarForm.FULL_TIME.value,
                    source_url=href,
                )
            )
    return candidates


async def import_academic_calendars(
    db: AsyncSession,
    http: httpx.AsyncClient,
    source_url: str = SOURCE_URL,
    concurrency: int | None = None,
) -> int:
    response = await http.get(source_url)
    response.raise_for_status()
    imported = 0
    candidates = parse_calendar_candidates(response.text, source_url)
    download_concurrency = concurrency or get_settings().spbstu_concurrency
    parse_workers = max(1, min(download_concurrency, os.cpu_count() or 1))
    semaphore = asyncio.Semaphore(download_concurrency)
    print(f"Found academic calendars: {len(candidates)}", flush=True)
    print(f"Download concurrency: {download_concurrency}, parse workers: {parse_workers}", flush=True)

    with ProcessPoolExecutor(max_workers=parse_workers) as parse_pool:
        tasks = [fetch_and_parse_calendar(http, semaphore, parse_pool, candidate) for candidate in candidates]
        for index, task in enumerate(asyncio.as_completed(tasks), start=1):
            result = await task
            save_started = perf_counter()
            await save_calendar(db, result.candidate, result.days, result.source_updated_at)
            save_seconds = perf_counter() - save_started
            imported += 1
            print(
                f"Imported {index}/{len(candidates)}: "
                f"{result.candidate.direction_code}, {result.candidate.admission_year}, {len(result.days)} days "
                f"(download {result.download_seconds:.2f}s, parse {result.parse_seconds:.2f}s, save {save_seconds:.2f}s)",
                flush=True,
            )
    await db.flush()
    return imported


async def fetch_and_parse_calendar(
    http: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    parse_pool: ProcessPoolExecutor,
    candidate: CalendarImportCandidate,
) -> CalendarImportResult:
    async with semaphore:
        download_started = perf_counter()
        zip_response = await http.get(candidate.source_url)
        zip_response.raise_for_status()
        download_seconds = perf_counter() - download_started
        pdf_data = extract_pdf_from_zip(zip_response.content)
        parse_started = perf_counter()
        loop = asyncio.get_running_loop()
        days = await loop.run_in_executor(parse_pool, parse_academic_calendar_pdf, pdf_data)
        parse_seconds = perf_counter() - parse_started
        return CalendarImportResult(
            candidate=candidate,
            days=days,
            source_updated_at=parse_last_modified(zip_response.headers.get("last-modified")),
            download_seconds=download_seconds,
            parse_seconds=parse_seconds,
        )


async def save_calendar(
    db: AsyncSession,
    candidate: CalendarImportCandidate,
    days: Iterable[ParsedAcademicCalendarDay],
    source_updated_at: datetime | None = None,
) -> AcademicCalendar:
    now = datetime.now(UTC)
    calendar = await db.scalar(
        select(AcademicCalendar).where(
            AcademicCalendar.direction_code == candidate.direction_code,
            AcademicCalendar.level == candidate.level,
            AcademicCalendar.admission_year == candidate.admission_year,
            AcademicCalendar.education_form == candidate.education_form,
        )
    )
    if calendar is None:
        calendar = AcademicCalendar(
            direction_code=candidate.direction_code,
            level=candidate.level,
            admission_year=candidate.admission_year,
            education_form=candidate.education_form,
            source_program_code=candidate.source_program_code,
            source_url=candidate.source_url,
            source_updated_at=source_updated_at,
            updated_at=now,
        )
        db.add(calendar)
        await db.flush()
    else:
        calendar.source_program_code = candidate.source_program_code
        calendar.source_url = candidate.source_url
        calendar.source_updated_at = source_updated_at
        calendar.updated_at = now
        await db.execute(delete(AcademicCalendarDay).where(AcademicCalendarDay.calendar_id == calendar.id))

    rows = [{"calendar_id": calendar.id, "date": day.date, "period_type": day.period_type} for day in set(days)]
    if rows:
        await db.execute(insert(AcademicCalendarDay), rows)
    await db.flush()
    return calendar


def extract_pdf_from_zip(data: bytes) -> bytes:
    with ZipFile(BytesIO(data)) as archive:
        pdf_names = [name for name in archive.namelist() if name.lower().endswith(".pdf")]
        if not pdf_names:
            raise ValueError("ZIP archive does not contain PDF")
        return archive.read(pdf_names[0])


def parse_last_modified(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = parsedate_to_datetime(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


async def main() -> None:
    settings = get_settings()
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(settings.spbstu_timeout),
        verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT),
    ) as http:
        async with SessionLocal() as db:
            count = await import_academic_calendars(db, http)
            await db.commit()
            print(f"Imported academic calendars: {count}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
