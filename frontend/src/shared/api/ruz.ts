import { z } from 'zod'
import { apiGet } from './http'

const facultySchema = z.object({
  id: z.number(),
  name: z.string(),
  abbr: z.string(),
})

const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  level: z.number().nullable(),
  type: z.string().nullable(),
  kind: z.number().nullable(),
  spec: z.string(),
  year: z.number().nullable(),
  faculty: facultySchema.nullable(),
})

const teacherSchema = z.object({
  id: z.number(),
  oid: z.number().nullable().optional(),
  full_name: z.string(),
  first_name: z.string().optional(),
  middle_name: z.string().optional(),
  last_name: z.string().optional(),
  grade: z.string().optional(),
  chair: z.string().optional(),
})

const buildingSchema = z.object({
  id: z.number(),
  name: z.string(),
  abbr: z.string(),
  address: z.string(),
})

const auditoriumSchema = z.object({
  id: z.number(),
  name: z.string(),
  building: buildingSchema,
})

const lessonTypeSchema = z.object({
  id: z.number().nullable(),
  name: z.string(),
  abbr: z.string(),
})

const lessonSchema = z.object({
  subject: z.string(),
  subject_short: z.string(),
  type: z.number().nullable(),
  additional_info: z.string(),
  time_start: z.string().nullable(),
  time_end: z.string().nullable(),
  typeObj: lessonTypeSchema.nullable(),
  parity: z.number().nullable(),
  webinar_url: z.string().optional(),
  lms_url: z.string().optional(),
  groups: z.array(groupSchema).optional(),
  teachers: z.array(teacherSchema).optional(),
  auditories: z.array(auditoriumSchema),
})

const daySchema = z.object({
  weekday: z.number(),
  date: z.string(),
  lessons: z.array(lessonSchema),
})

const weekSchema = z.object({
  date_start: z.string(),
  date_end: z.string(),
  is_odd: z.boolean(),
})

const scheduleMetaSchema = z.object({
  source: z.enum(['live', 'cache']),
  is_stale: z.boolean(),
  fetched_at: z.string().nullable().optional(),
  failed_refresh_at: z.string().nullable().optional(),
})

const facultyGroupsSchema = z.object({
  faculty: facultySchema,
  groups: z.array(groupSchema),
})

const groupScheduleSchema = z.object({
  week: weekSchema,
  group: groupSchema,
  days: z.array(daySchema),
  meta: scheduleMetaSchema.nullable().optional(),
})

const teacherScheduleSchema = z.object({
  week: weekSchema,
  teacher: teacherSchema,
  days: z.array(daySchema),
})

export type Faculty = z.infer<typeof facultySchema>
export type Group = z.infer<typeof groupSchema>
export type Teacher = z.infer<typeof teacherSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type GroupSchedule = z.infer<typeof groupScheduleSchema>
export type TeacherSchedule = z.infer<typeof teacherScheduleSchema>

export async function getFaculties(): Promise<Faculty[]> {
  return apiGet('/api/v1/faculties', z.array(facultySchema))
}

export async function getGroupsByFaculty(facultyId: number): Promise<Group[]> {
  const data = await apiGet(`/api/v1/faculties/${facultyId}/groups`, facultyGroupsSchema)
  return data.groups
}

export async function searchGroups(query: string): Promise<Group[]> {
  return apiGet(`/api/v1/groups/search?q=${encodeURIComponent(query)}`, z.array(groupSchema))
}

export async function searchTeachers(query: string): Promise<Teacher[]> {
  return apiGet(`/api/v1/teachers/search?q=${encodeURIComponent(query)}`, z.array(teacherSchema))
}

export async function getGroupSchedule(groupId: number, date: string): Promise<GroupSchedule> {
  return apiGet(`/api/v1/groups/${groupId}/schedule?date=${date}`, groupScheduleSchema)
}

export async function getTeacherSchedule(teacherId: number, date: string): Promise<TeacherSchedule> {
  return apiGet(`/api/v1/teachers/${teacherId}/schedule?date=${date}`, teacherScheduleSchema)
}
