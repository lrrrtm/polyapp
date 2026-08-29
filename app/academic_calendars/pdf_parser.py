from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import re
import zlib

import pymupdf

from app.academic_calendars.models import AcademicPeriodType

MONTHS = {
    "январь": 1,
    "февраль": 2,
    "март": 3,
    "апрель": 4,
    "май": 5,
    "июнь": 6,
    "июль": 7,
    "август": 8,
    "сентябрь": 9,
    "октябрь": 10,
    "ноябрь": 11,
    "декабрь": 12,
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

COLOR_PERIODS = {
    (129, 199, 132): AcademicPeriodType.THEORY.value,
    (186, 104, 200): AcademicPeriodType.EXAM.value,
    (100, 181, 246): AcademicPeriodType.PRACTICE.value,
    (77, 208, 225): AcademicPeriodType.PRACTICE.value,
    (161, 136, 127): AcademicPeriodType.DIPLOMA.value,
    (227, 227, 227): AcademicPeriodType.VACATION.value,
    (174, 213, 129): AcademicPeriodType.PRE_DIPLOMA_PRACTICE.value,
    (255, 105, 105): AcademicPeriodType.HOLIDAY.value,
}


@dataclass(frozen=True)
class ParsedAcademicCalendarDay:
    date: date
    period_type: str


@dataclass(frozen=True)
class ColoredRect:
    x0: float
    y0: float
    x1: float
    y1: float
    rgb: tuple[int, int, int]


@dataclass(frozen=True)
class DigitChar:
    value: str
    cx: float
    cy: float


@dataclass(frozen=True)
class MonthAnchor:
    month: int
    year: int | None
    x: float
    y: float


def parse_academic_calendar_pdf(pdf_data: bytes) -> list[ParsedAcademicCalendarDay]:
    doc = pymupdf.open(stream=pdf_data, filetype="pdf")
    rect_pages = extract_colored_day_rects(pdf_data, doc)
    records: set[ParsedAcademicCalendarDay] = set()

    for page_index, page in enumerate(doc):
        anchors = extract_month_anchors(page)
        digits = extract_digit_chars(page)
        for rect in rect_pages[page_index] if page_index < len(rect_pages) else []:
            day_digits = sorted(
                (digit for digit in digits if rect.x0 - 0.5 <= digit.cx <= rect.x1 + 0.5 and rect.y0 - 0.5 <= digit.cy <= rect.y1 + 0.5),
                key=lambda digit: digit.cx,
            )
            if not day_digits:
                continue
            anchor = find_month_anchor(rect, anchors)
            if anchor is None:
                continue
            day = int("".join(digit.value for digit in day_digits))
            year = anchor.year or page_start_year(page, page_index)
            if anchor.year is None and anchor.month < 9:
                year += 1
            try:
                records.add(ParsedAcademicCalendarDay(date(year, anchor.month, day), COLOR_PERIODS[rect.rgb]))
            except ValueError:
                continue

    return sorted(records, key=lambda item: (item.date, item.period_type))


def extract_colored_day_rects(pdf_data: bytes, doc: pymupdf.Document | None = None) -> list[list[ColoredRect]]:
    streams = []
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf_data, re.S):
        try:
            stream = zlib.decompress(match.group(1)).decode("latin1", "replace")
        except zlib.error:
            continue
        if " re W n" in stream and " rg" in stream:
            streams.append(stream)

    pages: list[list[ColoredRect]] = []
    pattern = re.compile(r"([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re W n\s+([\d.]+) ([\d.]+) ([\d.]+) rg")
    for stream in streams:
        rects = []
        for x, y, width, height, r, g, b in pattern.findall(stream):
            x0, y0, w, h = map(float, (x, y, width, height))
            rgb = tuple(round(float(channel) * 255) for channel in (r, g, b))
            if 8 <= w <= 30 and 8 <= h <= 30 and rgb in COLOR_PERIODS:
                rects.append(ColoredRect(x0, y0, x0 + w, y0 + h, rgb))  # type: ignore[arg-type]
        if rects:
            pages.append(rects)
    if pages or doc is None:
        return pages

    for page in doc:
        rects = []
        for drawing in page.get_drawings():
            fill = drawing.get("fill")
            rect = drawing.get("rect")
            if not fill or rect is None:
                continue
            rgb = tuple(round(float(channel) * 255) for channel in fill)
            width = rect.x1 - rect.x0
            height = rect.y1 - rect.y0
            if 8 <= width <= 30 and 8 <= height <= 30 and rgb in COLOR_PERIODS:
                rects.append(ColoredRect(rect.x0, rect.y0, rect.x1, rect.y1, rgb))  # type: ignore[arg-type]
        pages.append(rects)
    return pages


def extract_digit_chars(page: pymupdf.Page) -> list[DigitChar]:
    digits = []
    for block in page.get_text("rawdict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                for char in span.get("chars", []):
                    value = char.get("c", "")
                    if not value.isdigit():
                        continue
                    x0, y0, x1, y1 = char["bbox"]
                    digits.append(DigitChar(value, (x0 + x1) / 2, (y0 + y1) / 2))
    return digits


def extract_month_anchors(page: pymupdf.Page) -> list[MonthAnchor]:
    anchors = []
    words = page.get_text("words")
    for x0, y0, x1, _y1, word, *_ in words:
        month = MONTHS.get(word.lower())
        if month:
            year = find_month_year(x1, y0, words)
            anchors.append(MonthAnchor(month, year, (x0 + x1) / 2, y0))
    return anchors


def find_month_year(month_x1: float, month_y: float, words: list[tuple]) -> int | None:
    candidates = []
    for x0, y0, _x1, _y1, word, *_ in words:
        if x0 < month_x1 or abs(y0 - month_y) > 2 or not re.fullmatch(r"20\d{2}", word):
            continue
        candidates.append((x0 - month_x1, int(word)))
    return min(candidates)[1] if candidates else None


def find_month_anchor(rect: ColoredRect, anchors: list[MonthAnchor]) -> MonthAnchor | None:
    cx = (rect.x0 + rect.x1) / 2
    cy = (rect.y0 + rect.y1) / 2
    candidates = [anchor for anchor in anchors if anchor.y < cy and abs(anchor.x - cx) < 90]
    if not candidates:
        return None
    nearest_y = min(cy - anchor.y for anchor in candidates)
    row_candidates = [anchor for anchor in candidates if abs((cy - anchor.y) - nearest_y) < 1]
    return min(row_candidates, key=lambda anchor: abs(anchor.x - cx))


def page_start_year(page: pymupdf.Page, page_index: int) -> int:
    years = [int(match) for match in re.findall(r"\b20\d{2}\b", page.get_text())]
    return min(years) if years else 2025 + page_index
