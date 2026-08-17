import type { ScheduleItem } from './users'

export const queryKeys = {
  session: () => ['session'] as const,
  me: () => ['me'] as const,
  faculties: () => ['faculties'] as const,
  facultyGroups: (facultyId: number | undefined) => ['faculty-groups', facultyId] as const,
  scheduleRoot: () => ['schedule'] as const,
  scheduleEmpty: () => ['schedule', 'empty'] as const,
  schedule: (itemType: ScheduleItem['item_type'], ruzId: number | undefined, weekStart: string) =>
    ['schedule', itemType, ruzId, weekStart] as const,
  buildingMapLinks: () => ['building-map-links'] as const,
  groupsSearch: (query: string) => ['groups-search', query] as const,
  teachersSearch: (query: string) => ['teachers-search', query] as const,
  admissions: () => ['admissions'] as const,
  applicantCode: () => ['applicant-code'] as const,
}
