from datetime import date, timedelta

from app.schemas.ruz import GroupSchedule

MOCK_GROUP_ID = 42828


def get_mock_group_schedule(group_id: int, schedule_date: date | None) -> GroupSchedule | None:
    today = date.today()
    requested_date = schedule_date or today
    current_week_start = _week_start(today)
    requested_week_start = _week_start(requested_date)

    if group_id != MOCK_GROUP_ID or requested_week_start != current_week_start:
        return None

    return GroupSchedule.model_validate(
        {
            "week": {
                "date_start": current_week_start.isoformat(),
                "date_end": (current_week_start + timedelta(days=6)).isoformat(),
                "is_odd": True,
            },
            "group": {
                "id": MOCK_GROUP_ID,
                "name": "5130904/20102_2025",
                "level": 2,
                "type": "common",
                "kind": 0,
                "spec": "Программная инженерия",
                "year": 2025,
                "faculty": {
                    "id": 125,
                    "name": "Институт компьютерных наук и кибербезопасности",
                    "abbr": "ИКНК",
                },
            },
            "days": [
                _day(
                    current_week_start,
                    0,
                    [
                        _lesson(
                            "Математический анализ",
                            "Мат. анализ",
                            "10:00",
                            "11:30",
                            {"id": 1, "name": "Лекция", "abbr": "Лек"},
                            _teacher(9833, "Бабенков Валерий Иванович", "Высшая школа компьютерных технологий и информационных систем"),
                            _auditorium(2785, "1404", 11, "Гидробашня", "Гидробашня", "Политехническая ул., 29"),
                        ),
                        _lesson(
                            "Алгоритмы и структуры данных",
                            "Алгоритмы",
                            "12:00",
                            "13:30",
                            {"id": 2, "name": "Практика", "abbr": "Пр"},
                            _teacher(12483, "Антонов Александр Петрович", "Высшая школа программной инженерии"),
                            _auditorium(2756, "1324", 11, "Гидробашня", "Гидробашня", "Политехническая ул., 29"),
                        ),
                    ],
                ),
                _day(
                    current_week_start,
                    1,
                    [
                        _lesson(
                            "Базы данных",
                            "БД",
                            "09:00",
                            "10:30",
                            {"id": 1, "name": "Лекция", "abbr": "Лек"},
                            _teacher(14236, "Ильин Николай Петрович", "Кафедра физики"),
                            _auditorium(3512, "305", 4, "Учебный корпус N 2", "2 к.", "Политехническая ул., 29"),
                        ),
                        _lesson(
                            "Иностранный язык",
                            "Ин. язык",
                            "12:00",
                            "13:30",
                            {"id": 3, "name": "Лабораторная работа", "abbr": "Лаб"},
                            _teacher(16011, "Некрасова Татьяна Петровна", "Высшая инженерно-экономическая школа"),
                            _auditorium(4210, "355", 9, "Главное здание", "ГЗ", "Политехническая ул., 29"),
                        ),
                    ],
                ),
                _day(
                    current_week_start,
                    2,
                    [
                        _lesson(
                            "Объектно-ориентированное программирование",
                            "ООП",
                            "10:00",
                            "11:30",
                            {"id": 3, "name": "Лабораторная работа", "abbr": "Лаб"},
                            _teacher(17126, "Киреев Сергей Петрович", "Высшая школа программной инженерии"),
                            _auditorium(2794, "1332", 11, "Гидробашня", "Гидробашня", "Политехническая ул., 29"),
                        ),
                        _lesson(
                            "Дискретная математика",
                            "Дискретная мат.",
                            "14:00",
                            "15:30",
                            {"id": 2, "name": "Практика", "abbr": "Пр"},
                            _teacher(15174, "Бочков Александр Петрович", "Кафедра прикладной математики"),
                            _auditorium(4215, "366", 9, "Главное здание", "ГЗ", "Политехническая ул., 29"),
                        ),
                    ],
                ),
                _day(
                    current_week_start,
                    3,
                    [
                        _lesson(
                            "Компьютерная графика",
                            "Комп. графика",
                            "09:00",
                            "10:30",
                            {"id": 1, "name": "Лекция", "abbr": "Лек"},
                            _teacher(15731, "Петров С.", "Кафедра инженерной графики и дизайна"),
                            _auditorium(5122, "221", 23, "Научно-исследовательский корпус", "НИК", "Политехническая ул., 29"),
                        ),
                    ],
                ),
                _day(
                    current_week_start,
                    4,
                    [
                        _lesson(
                            "Основы проектной деятельности",
                            "ОПД",
                            "08:20",
                            "09:50",
                            {"id": 2, "name": "Практическое занятие", "abbr": "Прак"},
                            _teacher(12483, "Антонов Александр Петрович", "Высшая школа программной инженерии"),
                            _auditorium(2756, "1324", 11, "Гидробашня", "Гидробашня", "Политехническая ул., 29"),
                        ),
                        _lesson(
                            "Дискретная математика",
                            "Дискретная мат.",
                            "10:00",
                            "11:30",
                            {"id": 3, "name": "Лабораторная работа", "abbr": "Лаб"},
                            _teacher(15174, "Бочков Александр Петрович", "Кафедра прикладной математики"),
                            _auditorium(4215, "366", 9, "Главное здание", "ГЗ", "Политехническая ул., 29"),
                        ),
                        _lesson(
                            "История России",
                            "История",
                            "12:00",
                            "13:30",
                            {"id": 1, "name": "Лекция", "abbr": "Лек"},
                            _teacher(18092, "Головицкий Александр Петрович", "Высшая инженерно-физическая школа"),
                            _auditorium(4205, "346", 9, "Главное здание", "ГЗ", "Политехническая ул., 29"),
                        ),
                        _lesson(
                            "Информационная безопасность",
                            "Инф. безопасность",
                            "14:00",
                            "15:30",
                            {"id": 1, "name": "Лекция", "abbr": "Лек"},
                            _teacher(17126, "Киреев Сергей Петрович", "Высшая школа программной инженерии"),
                            _auditorium(2794, "1332", 11, "Гидробашня", "Гидробашня", "Политехническая ул., 29"),
                        ),
                        _lesson(
                            "Физическая культура",
                            "Физкультура",
                            "16:00",
                            "17:30",
                            {"id": 4, "name": "Практическое занятие", "abbr": "Прак"},
                            _teacher(16752, "Маслов Валерий Петрович", "Кафедра физики"),
                            _auditorium(6101, "Спортивный зал", 30, "Спортивный комплекс", "СК", "Политехническая ул., 27"),
                        ),
                        _lesson(
                            "Объектно-ориентированное программирование",
                            "ООП",
                            "18:00",
                            "19:30",
                            {"id": 3, "name": "Лабораторная работа", "abbr": "Лаб"},
                            _teacher(16011, "Некрасова Татьяна Петровна", "Высшая инженерно-экономическая школа"),
                            _auditorium(5122, "221", 23, "Научно-исследовательский корпус", "НИК", "Политехническая ул., 29"),
                        ),
                        _lesson(
                            "Введение в анализ данных",
                            "Анализ данных",
                            "19:40",
                            "21:10",
                            {"id": 2, "name": "Практическое занятие", "abbr": "Прак"},
                            _teacher(14236, "Ильин Николай Петрович", "Кафедра физики"),
                            _auditorium(3512, "305", 4, "Учебный корпус N 2", "2 к.", "Политехническая ул., 29"),
                        ),
                    ],
                ),
                _day(current_week_start, 5, []),
                _day(current_week_start, 6, []),
            ],
        }
    )


def _week_start(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _day(week_start: date, offset: int, lessons: list[dict[str, object]]) -> dict[str, object]:
    return {
        "weekday": offset + 1,
        "date": (week_start + timedelta(days=offset)).isoformat(),
        "lessons": lessons,
    }


def _lesson(
    subject: str,
    subject_short: str,
    time_start: str,
    time_end: str,
    lesson_type: dict[str, object],
    teacher: dict[str, object],
    auditorium: dict[str, object],
) -> dict[str, object]:
    return {
        "subject": subject,
        "subject_short": subject_short,
        "type": lesson_type["id"],
        "additional_info": "",
        "time_start": time_start,
        "time_end": time_end,
        "typeObj": lesson_type,
        "parity": 0,
        "teachers": [teacher],
        "auditories": [auditorium],
    }


def _teacher(teacher_id: int, full_name: str, chair: str) -> dict[str, object]:
    return {
        "id": teacher_id,
        "full_name": full_name,
        "chair": chair,
    }


def _auditorium(
    auditorium_id: int,
    name: str,
    building_id: int,
    building_name: str,
    building_abbr: str,
    address: str,
) -> dict[str, object]:
    return {
        "id": auditorium_id,
        "name": name,
        "building": {
            "id": building_id,
            "name": building_name,
            "abbr": building_abbr,
            "address": address,
        },
    }
