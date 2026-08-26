import { formatLessonTime } from '../../shared/date'
import type { ScheduleChange, ScheduleChangeEvent, ScheduleChangeLesson } from '../../shared/api/scheduleChanges'
import type { ScheduleItem } from '../../shared/api/users'
import type { Lesson, Schedule } from './schedule-utils'

export type ScheduleChangeKind = 'added' | 'removed' | 'time' | 'date' | 'auditorium' | 'teacher'

export type LessonChangeDetail = {
  kind: ScheduleChangeKind
  before?: string
  after?: string
}

export type ScheduleLessonItem = {
  id: string
  lesson: Lesson | null
  summary: {
    subject: string
    lessonType: string
    timeStart: string
    timeEnd: string
    teachers: string
    auditories: string
  }
  changes: LessonChangeDetail[]
}

export function buildScheduleLessonItems(
  lessons: Lesson[],
  selectedDate: string,
  events: ScheduleChangeEvent[],
): ScheduleLessonItem[] {
  const liveKeys = new Set(lessons.map((lesson) => getLiveLessonKey(selectedDate, lesson)))
  const changesByLesson = new Map<string, LessonChangeDetail[]>()
  const changedItems: ScheduleLessonItem[] = []
  const removedItems: ScheduleLessonItem[] = []

  for (const event of events) {
    for (const change of event.changes) {
      if (change.type === 'lesson_removed') {
        const lesson = change.lesson ?? change.before
        if (lesson && getLessonDate(lesson) === selectedDate) {
          removedItems.push(createRemovedItem(lesson, change))
        }
        continue
      }

      const lesson = change.lesson ?? change.after
      if (!lesson || getLessonDate(lesson) !== selectedDate) {
        continue
      }

      const key = getChangeLessonKey(lesson)
      const details = getChangeDetails(change)
      if (liveKeys.has(key)) {
        changesByLesson.set(key, [...(changesByLesson.get(key) ?? []), ...details])
      } else {
        changedItems.push(createChangedItem(lesson, details))
      }
    }
  }

  const lessonItems = lessons.map((lesson, index) => ({
    id: `lesson:${selectedDate}:${lesson.time_start ?? index}:${lesson.subject}`,
    lesson,
    summary: {
      subject: lesson.subject,
      lessonType: lesson.typeObj?.name || lesson.typeObj?.abbr || 'Занятие',
      timeStart: formatLessonTime(lesson.time_start),
      timeEnd: formatLessonTime(lesson.time_end),
      teachers: lesson.teachers?.map((teacher) => teacher.full_name).join(', ') ?? '',
      auditories: lesson.auditories.map((auditorium) => {
        const building = auditorium.building.name
        const room = /^\d+$/.test(auditorium.name) ? `ауд. ${auditorium.name}` : auditorium.name
        return building ? `${building}, ${room}` : room
      }).join(', '),
    },
    changes: changesByLesson.get(getLiveLessonKey(selectedDate, lesson)) ?? [],
  }))

  return [...lessonItems, ...changedItems, ...removedItems].sort((first, second) => first.summary.timeStart.localeCompare(second.summary.timeStart))
}

export function createDemoScheduleChanges(
  schedule: Schedule | undefined,
  activeScheduleItem: ScheduleItem | null | undefined,
  selectedDate: string,
): ScheduleChangeEvent[] {
  if (!schedule || activeScheduleItem?.item_type !== 'group') {
    return []
  }

  const changes = [
    {
      type: 'lesson_added',
      lesson: demoLesson(selectedDate, '09:00', '10:30', 'Демонстрационное добавленное занятие'),
    },
    updatedDemoLessonChange(selectedDate, '10:40', '12:10', 'Демонстрация изменения времени', ['time_start', 'time_end']),
    updatedDemoLessonChange(selectedDate, '12:20', '13:50', 'Демонстрация изменения даты', ['date']),
    updatedDemoLessonChange(selectedDate, '14:00', '15:30', 'Демонстрация изменения аудитории', ['auditories']),
    updatedDemoLessonChange(selectedDate, '15:40', '17:10', 'Демонстрация изменения преподавателя', ['teachers']),
    updatedDemoLessonChange(selectedDate, '17:20', '18:50', 'Демонстрация нескольких изменений', [
      'time_start',
      'time_end',
      'auditories',
      'teachers',
    ]),
    {
      type: 'lesson_removed',
      lesson: demoLesson(selectedDate, '19:00', '20:30', 'Демонстрационное отменённое занятие'),
    },
  ].filter((change): change is ScheduleChange => Boolean(change))

  return [
    {
      id: '00000000-0000-0000-0000-000000000000',
      item_type: 'group',
      ruz_id: activeScheduleItem.ruz_id,
      week_start: schedule.week.date_start.replaceAll('.', '-'),
      detected_at: new Date().toISOString(),
      changes,
    },
  ]
}

function getChangeDetails(change: ScheduleChange): LessonChangeDetail[] {
  if (change.type === 'lesson_added') {
    return [{ kind: 'added' }]
  }
  if (change.type === 'lesson_removed') {
    return [{ kind: 'removed' }]
  }
  if (change.type !== 'lesson_updated') {
    return []
  }

  return (change.fields ?? []).flatMap((field): LessonChangeDetail[] => {
    if (field === 'date') {
      return [{ kind: 'date', before: formatChangeDate(change.before), after: formatChangeDate(change.after) }]
    }
    if (field === 'time_start' || field === 'time_end') {
      return field === 'time_start' ? [{ kind: 'time', before: formatChangeTime(change.before), after: formatChangeTime(change.after) }] : []
    }
    if (field === 'auditories') {
      return [{ kind: 'auditorium', before: formatNamedItems(change.before?.auditories), after: formatNamedItems(change.after?.auditories) }]
    }
    if (field === 'teachers') {
      return [{ kind: 'teacher', before: formatNamedItems(change.before?.teachers), after: formatNamedItems(change.after?.teachers) }]
    }

    return []
  })
}

function createChangedItem(lesson: ScheduleChangeLesson, changes: LessonChangeDetail[]): ScheduleLessonItem {
  return {
    id: `changed:${getChangeLessonKey(lesson)}:${changes.map((change) => change.kind).join(',')}`,
    lesson: null,
    summary: createChangeLessonSummary(lesson),
    changes,
  }
}

function createRemovedItem(lesson: ScheduleChangeLesson, change: ScheduleChange): ScheduleLessonItem {
  return {
    id: `removed:${getChangeLessonKey(lesson)}`,
    lesson: null,
    summary: createChangeLessonSummary(lesson),
    changes: getChangeDetails(change),
  }
}

function createChangeLessonSummary(lesson: ScheduleChangeLesson): ScheduleLessonItem['summary'] {
  return {
    subject: getString(lesson.subject) || 'Занятие',
    lessonType: getString(lesson.type_name) || 'Занятие',
    timeStart: formatChangeTimeStart(lesson),
    timeEnd: formatChangeTimeEnd(lesson),
    teachers: formatNamedItems(lesson.teachers),
    auditories: formatNamedItems(lesson.auditories),
  }
}

function getLiveLessonKey(date: string, lesson: Lesson) {
  return `${date}|${lesson.time_start ?? ''}|${lesson.subject}`
}

function getChangeLessonKey(lesson: ScheduleChangeLesson) {
  return `${getLessonDate(lesson)}|${getString(lesson.time_start)}|${getString(lesson.subject)}`
}

function getLessonDate(lesson: ScheduleChangeLesson) {
  return getString(lesson.date).replaceAll('.', '-')
}

function updatedDemoLessonChange(date: string, start: string, end: string, subject: string, fields: string[]): ScheduleChange {
  const after = demoLesson(date, start, end, subject)
  const before = { ...after }
  if (fields.includes('time_start')) {
    before.time_start = `${date}T08:00:00+03:00`
    before.time_end = `${date}T09:30:00+03:00`
  }
  if (fields.includes('date')) {
    before.date = '2026-08-25'
  }
  if (fields.includes('auditories')) {
    before.auditories = [{ name: '101', building_name: 'Главный учебный корпус' }]
  }
  if (fields.includes('teachers')) {
    before.teachers = [{ name: 'Петров Петр Петрович' }]
  }

  return { type: 'lesson_updated', before, after, fields }
}

function demoLesson(date: string, start: string, end: string, subject: string): ScheduleChangeLesson {
  return {
    date,
    time_start: `${date}T${start}:00+03:00`,
    time_end: `${date}T${end}:00+03:00`,
    subject,
    type_name: 'Лекция',
    teachers: [{ name: 'Иванов Иван Иванович' }],
    auditories: [{ name: '301', building_name: 'Главный учебный корпус' }],
  }
}

function formatChangeDate(lesson: ScheduleChangeLesson | undefined) {
  return getLessonDate(lesson ?? {}) || 'не указано'
}

function formatChangeTime(lesson: ScheduleChangeLesson | undefined) {
  return [formatChangeTimeStart(lesson), formatChangeTimeEnd(lesson)].filter(Boolean).join(' - ') || 'не указано'
}

function formatChangeTimeStart(lesson: ScheduleChangeLesson | undefined) {
  return formatRawTime(getString(lesson?.time_start))
}

function formatChangeTimeEnd(lesson: ScheduleChangeLesson | undefined) {
  return formatRawTime(getString(lesson?.time_end))
}

function formatRawTime(value: string) {
  return value.includes('T') ? formatLessonTime(value) : value
}

function formatNamedItems(value: unknown) {
  if (!Array.isArray(value)) {
    return 'не указано'
  }

  const names = value
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return ''
      }

      const name = 'name' in item ? getString(item.name) : ''
      const building = 'building_name' in item ? getString(item.building_name) : ''
      return building && name ? `${building}, ${name}` : name
    })
    .filter(Boolean)

  return names.join(', ') || 'не указано'
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : ''
}
