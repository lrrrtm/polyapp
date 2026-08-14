import { z } from 'zod'
import { apiGet, apiPost, apiPut } from './http'

const sessionStatusSchema = z.object({
  has_user: z.boolean(),
})

const scheduleItemSchema = z.object({
  id: z.uuid(),
  item_type: z.enum(['group', 'teacher']),
  ruz_id: z.number(),
  is_primary: z.boolean(),
  created_at: z.string(),
})

const userProfileSchema = z.object({
  id: z.uuid(),
  primary_group: scheduleItemSchema.nullable(),
  favorites: z.array(scheduleItemSchema),
})

export type SessionStatus = {
  hasUser: boolean
}

export type ScheduleItem = z.infer<typeof scheduleItemSchema>
export type UserProfile = z.infer<typeof userProfileSchema>

export async function getSessionStatus(): Promise<SessionStatus> {
  const data = await apiGet('/api/v1/session', sessionStatusSchema)
  return { hasUser: data.has_user }
}

export async function getCurrentUser(): Promise<UserProfile> {
  return apiGet('/api/v1/me', userProfileSchema)
}

export async function createCurrentUser(): Promise<UserProfile> {
  return getCurrentUser()
}

export async function setPrimaryGroup(ruzId: number): Promise<UserProfile> {
  return apiPut('/api/v1/me/primary-group', { ruz_id: ruzId }, userProfileSchema)
}

export async function addFavorite(itemType: ScheduleItem['item_type'], ruzId: number): Promise<ScheduleItem> {
  return apiPost('/api/v1/me/favorites', { item_type: itemType, ruz_id: ruzId }, scheduleItemSchema)
}
