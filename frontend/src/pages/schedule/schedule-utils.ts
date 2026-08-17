import { getGroupSchedule, getTeacherSchedule, type Group, type GroupSchedule, type Teacher, type TeacherSchedule } from '../../shared/api/ruz'
import type { ScheduleItem } from '../../shared/api/users'

export type Schedule = GroupSchedule | TeacherSchedule
export type Lesson = Schedule['days'][number]['lessons'][number]
export type SearchResult = {
  itemType: ScheduleItem['item_type']
  ruzId: number
  title: string
  subtitle: string
}

export function fetchSchedule(item: ScheduleItem, date: string): Promise<Schedule> {
  if (item.item_type === 'teacher') {
    return getTeacherSchedule(item.ruz_id, date)
  }

  return getGroupSchedule(item.ruz_id, date)
}

export function dedupeScheduleItems(items: Array<ScheduleItem | null | undefined>): ScheduleItem[] {
  const seen = new Set<string>()
  return items.filter((item): item is ScheduleItem => {
    if (!item) {
      return false
    }

    const key = `${item.item_type}:${item.ruz_id}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function getScheduleTitle(item: ScheduleItem | null | undefined, schedule: Schedule | undefined): string {
  if (!item) {
    return 'Расписание'
  }

  if (item.item_type === 'teacher') {
    return schedule && 'teacher' in schedule ? schedule.teacher.full_name : 'Расписание'
  }

  return schedule && 'group' in schedule ? schedule.group.name : 'Расписание'
}

export function getScheduleSubtitle(item: ScheduleItem | null | undefined, schedule: Schedule | undefined): string {
  if (!item || !schedule) {
    return ''
  }

  if (item.item_type === 'teacher') {
    return 'teacher' in schedule ? formatChair(schedule.teacher.chair) : ''
  }

  return 'group' in schedule ? (schedule.group.faculty?.abbr ?? '') : ''
}

export function groupToSearchResult(group: Group): SearchResult {
  return {
    itemType: 'group',
    ruzId: group.id,
    title: group.name,
    subtitle: group.faculty?.abbr ?? '',
  }
}

export function teacherToSearchResult(teacher: Teacher): SearchResult {
  return {
    itemType: 'teacher',
    ruzId: teacher.id,
    title: teacher.full_name,
    subtitle: formatChair(teacher.chair),
  }
}

export function formatAuditorium(auditorium: { name: string; building: { abbr: string; name: string } }): string {
  const building = auditorium.building.name
  const room = /^\d+$/.test(auditorium.name) ? `ауд. ${auditorium.name}` : auditorium.name
  return building ? `${building}, ${room}` : room
}

export function getLessonMapUrl(lesson: Lesson, buildingMapLinksById: Map<number, { yandex_maps_url: string }>): string | undefined {
  return lesson.auditories
    .map((auditorium) => buildingMapLinksById.get(auditorium.building.id)?.yandex_maps_url)
    .find((url): url is string => Boolean(url))
}

export function isLessonActive(timeStart: string | null, timeEnd: string | null, now: Date): boolean {
  if (!timeStart || !timeEnd) {
    return false
  }

  const start = new Date(timeStart).getTime()
  const end = new Date(timeEnd).getTime()
  const current = now.getTime()
  return current >= start && current <= end
}

export function isBreakActive(previousLesson: Lesson, nextLesson: Lesson, now: Date): boolean {
  if (!previousLesson.time_end || !nextLesson.time_start) {
    return false
  }

  const previousEnd = new Date(previousLesson.time_end).getTime()
  const nextStart = new Date(nextLesson.time_start).getTime()
  const current = now.getTime()
  return current > previousEnd && current < nextStart
}

export function isLessonPast(timeEnd: string | null, now: Date): boolean {
  if (!timeEnd) {
    return false
  }

  return new Date(timeEnd).getTime() < now.getTime()
}

export function getBreakDurationMinutes(previousLesson: Lesson, nextLesson: Lesson): number {
  if (!previousLesson.time_end || !nextLesson.time_start) {
    return 0
  }

  const previousEnd = new Date(previousLesson.time_end).getTime()
  const nextStart = new Date(nextLesson.time_start).getTime()
  const diffMinutes = Math.round((nextStart - previousEnd) / 60_000)
  return diffMinutes > 0 ? diffMinutes : 0
}

export function getBreakRemainingSeconds(previousLesson: Lesson, nextLesson: Lesson, now: Date): number {
  if (!isBreakActive(previousLesson, nextLesson, now) || !nextLesson.time_start) {
    return 0
  }

  const nextStart = new Date(nextLesson.time_start).getTime()
  return Math.max(0, Math.ceil((nextStart - now.getTime()) / 1000))
}

export function formatBreakDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} мин`
  }

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes > 0 ? `${hours} ч ${restMinutes} мин` : `${hours} ч`
}

export function formatBreakCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  return hours > 0 ? `${pad(hours)}:${pad(minutes)}` : `${pad(minutes)}:${pad(seconds)}`
}

export function isScheduleItemSaved(
  items: ScheduleItem[],
  itemType: ScheduleItem['item_type'],
  ruzId: number,
): boolean {
  return items.some((item) => item.item_type === itemType && item.ruz_id === ruzId)
}

function formatChair(chair: string | undefined): string {
  return chair?.replace(/^\d+(?:\/\d+)?\s+/, '') ?? ''
}
