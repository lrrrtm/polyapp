import { z } from 'zod'
import { apiGet } from './http'

const changeLessonSchema = z.record(z.string(), z.unknown())

const scheduleChangeSchema = z.object({
  type: z.string(),
  fields: z.array(z.string()).optional(),
  before: changeLessonSchema.optional(),
  after: changeLessonSchema.optional(),
  lesson: changeLessonSchema.optional(),
})

const scheduleChangeEventSchema = z.object({
  id: z.uuid(),
  item_type: z.string(),
  ruz_id: z.number(),
  week_start: z.string(),
  detected_at: z.string(),
  changes: z.array(scheduleChangeSchema),
})

export type ScheduleChangeLesson = z.infer<typeof changeLessonSchema>
export type ScheduleChange = z.infer<typeof scheduleChangeSchema>
export type ScheduleChangeEvent = z.infer<typeof scheduleChangeEventSchema>

export async function getScheduleChanges(): Promise<ScheduleChangeEvent[]> {
  return apiGet('/api/v1/me/schedule-changes', z.array(scheduleChangeEventSchema))
}
