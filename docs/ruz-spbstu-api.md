# RUZ SPbSTU API

Base URL:

```text
https://ruz.spbstu.ru/api/v1/ruz/
```

The API is public and returns JSON. Most errors are returned with HTTP `200` and
a JSON body like:

```json
{
  "error": true,
  "text": "Группа: 999999 не найден"
}
```

So a client should check both the HTTP status and the `error` field in the
response body.

## JSON Endpoints

| Method | Endpoint | Description | Query params | Response shape |
| --- | --- | --- | --- | --- |
| `GET` | `/faculties` | List faculties/institutes. | None | `{ "faculties": Faculty[] }` |
| `GET` | `/faculties/{faculty_id}` | Get one faculty/institute. | None | `Faculty` or API error |
| `GET` | `/faculties/{faculty_id}/groups` | List groups for a faculty/institute. | None | `{ "faculty": Faculty, "groups": Group[] }` |
| `GET` | `/search/groups` | Search groups by name. | `q` - search string | `{ "groups": Group[] }` |
| `GET` | `/scheduler/{group_id}` | Get group schedule for the current week. | None | `GroupSchedule` |
| `GET` | `/scheduler/{group_id}` | Get group schedule for the week containing `date`. | `date` - `YYYY-MM-DD` or `YYYY-M-D` | `GroupSchedule` |
| `GET` | `/teachers` | List teachers. | None | `{ "teachers": Teacher[] }` |
| `GET` | `/teachers/{teacher_id}` | Get one teacher. | None | `Teacher` or API error |
| `GET` | `/search/teachers` | Search teachers by name. | `q` - search string | `{ "teachers": Teacher[] }` |
| `GET` | `/teachers/{teacher_id}/scheduler` | Get teacher schedule for the current week. | None | `TeacherSchedule` |
| `GET` | `/teachers/{teacher_id}/scheduler` | Get teacher schedule for the week containing `date`. | `date` - `YYYY-MM-DD` or `YYYY-M-D` | `TeacherSchedule` |
| `GET` | `/buildings` | List buildings. | None | `{ "buildings": Building[] }` |
| `GET` | `/buildings/{building_id}` | Get one building. | None | `Building` or API error |
| `GET` | `/buildings/{building_id}/rooms` | List rooms/auditories in a building. | None | `{ "building": Building, "rooms": Room[] }` |
| `GET` | `/buildings/{building_id}/rooms/{room_id}/scheduler` | Get room schedule for the current week. | None | `RoomSchedule` |
| `GET` | `/buildings/{building_id}/rooms/{room_id}/scheduler` | Get room schedule for the week containing `date`. | `date` - `YYYY-MM-DD` or `YYYY-M-D` | `RoomSchedule` |

## Examples

### Faculties

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/faculties
```

Response:

```json
{
  "faculties": [
    {
      "id": 125,
      "name": "Институт компьютерных наук и кибербезопасности",
      "abbr": "ИКНК"
    }
  ]
}
```

### Faculty

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/faculties/125
```

Response:

```json
{
  "id": 125,
  "name": "Институт компьютерных наук и кибербезопасности",
  "abbr": "ИКНК"
}
```

### Groups By Faculty

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/faculties/125/groups
```

Response:

```json
{
  "faculty": {
    "id": 125,
    "name": "Институт компьютерных наук и кибербезопасности",
    "abbr": "ИКНК"
  },
  "groups": [
    {
      "id": 45385,
      "name": "5130201/60002",
      "level": 1,
      "type": "common",
      "kind": 0,
      "spec": "",
      "year": 2026
    }
  ]
}
```

### Group Search

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/search/groups?q=5130904
```

Response:

```json
{
  "groups": [
    {
      "id": 45476,
      "name": "5130904/50003",
      "level": 2,
      "type": "common",
      "kind": 0,
      "spec": "",
      "year": 2026,
      "faculty": {
        "id": 125,
        "name": "Институт компьютерных наук и кибербезопасности",
        "abbr": "ИКНК"
      }
    }
  ]
}
```

### Group Schedule

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/scheduler/42828?date=2026-08-10
```

Response:

```json
{
  "week": {
    "date_start": "2026.08.10",
    "date_end": "2026.08.16",
    "is_odd": false
  },
  "group": {
    "id": 42828,
    "name": "5130904/20102_2025",
    "level": 5,
    "type": "common",
    "kind": 0,
    "spec": "",
    "year": 2026,
    "faculty": {
      "id": 125,
      "name": "Институт компьютерных наук и кибербезопасности",
      "abbr": "ИКНК"
    }
  },
  "days": []
}
```

When lessons exist, `days` contains day objects:

```json
{
  "weekday": 1,
  "date": "2026.03.16",
  "lessons": [
    {
      "subject": "Практический курс первого иностранного языка",
      "subject_short": "Практический курс первого иностранного языка",
      "type": 0,
      "additional_info": "",
      "time_start": "10:00",
      "time_end": "11:40",
      "typeObj": {
        "id": 0,
        "name": "Практика",
        "abbr": "Пр"
      },
      "parity": 0,
      "groups": [],
      "teachers": [],
      "auditories": [],
      "webinar_url": "",
      "lms_url": ""
    }
  ]
}
```

Field presence is stable, but arrays can be empty and URL fields can be empty
strings.

### Teachers

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/teachers
```

Response:

```json
{
  "teachers": [
    {
      "id": 9833,
      "oid": 31878,
      "full_name": "Бабенков Валерий Иванович",
      "first_name": "Бабенков",
      "middle_name": "Валерий",
      "last_name": "Иванович",
      "grade": "",
      "chair": "37/13 Кафедра \"Экономика и менеджмент в энергетике \""
    }
  ]
}
```

### Teacher

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/teachers/9833
```

Response:

```json
{
  "id": 9833,
  "oid": 31878,
  "full_name": "Бабенков Валерий Иванович",
  "first_name": "Бабенков",
  "middle_name": "Валерий",
  "last_name": "Иванович",
  "grade": "",
  "chair": "37/13 Кафедра \"Экономика и менеджмент в энергетике \""
}
```

### Teacher Search

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/search/teachers?q=Иванов
```

Response:

```json
{
  "teachers": [
    {
      "id": 9833,
      "oid": 31878,
      "full_name": "Бабенков Валерий Иванович",
      "first_name": "Бабенков",
      "middle_name": "Валерий",
      "last_name": "Иванович",
      "grade": "",
      "chair": "37/13 Кафедра \"Экономика и менеджмент в энергетике \""
    }
  ]
}
```

### Teacher Schedule

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/teachers/9833/scheduler?date=2026-04-13
```

Response:

```json
{
  "week": {
    "date_start": "2026.04.13",
    "date_end": "2026.04.19",
    "is_odd": true
  },
  "teacher": {
    "id": 9833,
    "oid": 31878,
    "full_name": "Бабенков Валерий Иванович",
    "first_name": "Бабенков",
    "middle_name": "Валерий",
    "last_name": "Иванович",
    "grade": "",
    "chair": "37/13 Кафедра \"Экономика и менеджмент в энергетике \""
  },
  "days": []
}
```

### Buildings

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/buildings
```

Response:

```json
{
  "buildings": [
    {
      "id": 23,
      "name": "9-й учебный корпус",
      "abbr": "9 к.",
      "address": ""
    }
  ]
}
```

### Building

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/buildings/23
```

Response:

```json
{
  "id": 23,
  "name": "9-й учебный корпус",
  "abbr": "9 к.",
  "address": ""
}
```

### Rooms By Building

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/buildings/23/rooms
```

Response:

```json
{
  "building": {
    "id": 23,
    "name": "9-й учебный корпус",
    "abbr": "9 к.",
    "address": ""
  },
  "rooms": [
    {
      "id": 759,
      "name": "217"
    }
  ]
}
```

### Room Schedule

Request:

```http
GET https://ruz.spbstu.ru/api/v1/ruz/buildings/23/rooms/759/scheduler?date=2026-03-16
```

Response:

```json
{
  "week": {
    "date_start": "2026.03.16",
    "date_end": "2026.03.22",
    "is_odd": true
  },
  "room": {
    "id": 759,
    "name": "217",
    "building": {
      "id": 23,
      "name": "9-й учебный корпус",
      "abbr": "9 к.",
      "address": ""
    }
  },
  "days": []
}
```

## Data Models

### Faculty

```json
{
  "id": 125,
  "name": "Институт компьютерных наук и кибербезопасности",
  "abbr": "ИКНК"
}
```

### Group

```json
{
  "id": 42828,
  "name": "5130904/20102_2025",
  "level": 5,
  "type": "common",
  "kind": 0,
  "spec": "",
  "year": 2026,
  "faculty": {
    "id": 125,
    "name": "Институт компьютерных наук и кибербезопасности",
    "abbr": "ИКНК"
  }
}
```

The `faculty` field is present in search and schedule responses, but not in
`/faculties/{faculty_id}/groups`.

### Teacher

```json
{
  "id": 9833,
  "oid": 31878,
  "full_name": "Бабенков Валерий Иванович",
  "first_name": "Бабенков",
  "middle_name": "Валерий",
  "last_name": "Иванович",
  "grade": "",
  "chair": "37/13 Кафедра \"Экономика и менеджмент в энергетике \""
}
```

### Building

```json
{
  "id": 23,
  "name": "9-й учебный корпус",
  "abbr": "9 к.",
  "address": ""
}
```

### Room

```json
{
  "id": 759,
  "name": "217",
  "building": {
    "id": 23,
    "name": "9-й учебный корпус",
    "abbr": "9 к.",
    "address": ""
  }
}
```

The `building` field is present in schedule responses. Room list responses only
contain `id` and `name` for each room.

### Week

```json
{
  "date_start": "2026.08.10",
  "date_end": "2026.08.16",
  "is_odd": false
}
```

### Day

```json
{
  "weekday": 1,
  "date": "2026.03.16",
  "lessons": []
}
```

### Lesson

```json
{
  "subject": "Практический курс первого иностранного языка",
  "subject_short": "Практический курс первого иностранного языка",
  "type": 0,
  "additional_info": "",
  "time_start": "10:00",
  "time_end": "11:40",
  "typeObj": {
    "id": 0,
    "name": "Практика",
    "abbr": "Пр"
  },
  "parity": 0,
  "groups": [],
  "teachers": [],
  "auditories": [],
  "webinar_url": "",
  "lms_url": ""
}
```

## Website Routes And Exports

These are not the JSON API, but the website exposes them and they may be useful
for links or exports.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/` | Faculty list page. |
| `GET` | `/faculty/{faculty_id}/groups` | Faculty groups page. |
| `GET` | `/faculty/{faculty_id}/groups/{group_id}` | Group schedule page. |
| `GET` | `/faculty/{faculty_id}/groups/{group_id}?date=YYYY-M-D` | Group schedule page for a week. |
| `GET` | `/faculty/{faculty_id}/groups/{group_id}/print?date=YYYY-M-D` | Printable grid view for a group. |
| `GET` | `/faculty/{faculty_id}/groups/{group_id}/pdf?date=YYYY-M-D` | Group schedule PDF export. |
| `GET` | `/faculty/{faculty_id}/groups/{group_id}/ical?date=YYYY-M-D` | Group schedule iCal export. |
| `GET` | `/teachers/{teacher_id}` | Teacher schedule page. |
| `GET` | `/teachers/{teacher_id}?date=YYYY-M-D` | Teacher schedule page for a week. |
| `GET` | `/teachers/{teacher_id}/print?date=YYYY-M-D` | Printable grid view for a teacher. |
| `GET` | `/teachers/{teacher_id}/pdf?date=YYYY-M-D` | Teacher schedule PDF export. |
| `GET` | `/teachers/{teacher_id}/ical?date=YYYY-M-D` | Teacher schedule iCal export. |
| `GET` | `/places/{building_id}/{room_id}` | Room schedule page. |
| `GET` | `/places/{building_id}/{room_id}?date=YYYY-M-D` | Room schedule page for a week. |
| `GET` | `/search/groups?q={query}` | Website group search page. |
| `GET` | `/search/teacher?q={query}` | Website teacher search page. |

## Python Client Notes

- Use one base URL: `https://ruz.spbstu.ru/api/v1/ruz/`.
- URL-encode search strings.
- Treat `date` as any date inside the target week; the server returns the whole
  week.
- Normalize returned API dates from `YYYY.MM.DD`.
- Check for `{"error": true, "text": "..."}` even when HTTP status is `200`.
- Empty schedules are valid and return `days: []`.

