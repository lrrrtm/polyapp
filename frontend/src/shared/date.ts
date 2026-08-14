const isoDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const pageDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const scheduleHeaderDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
})

const lessonTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Moscow',
})

export function toIsoDate(date: Date): string {
  return isoDateFormatter.format(date)
}

export function addDays(date: string, days: number): string {
  const nextDate = new Date(`${date}T12:00:00`)
  nextDate.setDate(nextDate.getDate() + days)
  return toIsoDate(nextDate)
}

export function getWeekStartDate(date: string): string {
  const currentDate = new Date(`${date}T12:00:00`)
  const day = currentDate.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  currentDate.setDate(currentDate.getDate() - daysSinceMonday)
  return toIsoDate(currentDate)
}

export function formatPageDate(date: string): string {
  return pageDateFormatter.format(new Date(`${date}T12:00:00`))
}

export function formatScheduleHeaderDate(date: string): string {
  const formattedDate = scheduleHeaderDateFormatter.format(new Date(`${date}T12:00:00`))
  return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
}

export function formatLessonTime(value: string | null): string {
  if (!value) {
    return ''
  }

  return lessonTimeFormatter.format(new Date(value))
}
