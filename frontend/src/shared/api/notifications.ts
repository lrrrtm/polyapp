import { z } from 'zod'
import { apiDelete, apiGet, apiPost, apiPut } from './http'

const notificationSettingsSchema = z.object({
  schedule_changes_enabled: z.boolean(),
  lesson_added_enabled: z.boolean(),
  lesson_removed_enabled: z.boolean(),
  time_changed_enabled: z.boolean(),
  auditorium_changed_enabled: z.boolean(),
  teacher_changed_enabled: z.boolean(),
})

const telegramAccountSchema = z.object({
  id: z.uuid(),
  telegram_user_id: z.number(),
  telegram_chat_id: z.number(),
  telegram_username: z.string().nullable(),
  is_active: z.boolean(),
  linked_at: z.string(),
})

const telegramStatusSchema = z.object({
  connected: z.boolean(),
  account: telegramAccountSchema.nullable(),
  settings: notificationSettingsSchema,
})

const telegramLinkSchema = z.object({
  token: z.string(),
  url: z.string(),
  expires_at: z.string(),
})

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>
export type NotificationSettingKey = keyof NotificationSettings
export type TelegramStatus = z.infer<typeof telegramStatusSchema>
export type TelegramLink = z.infer<typeof telegramLinkSchema>

export async function getTelegramStatus(): Promise<TelegramStatus> {
  return apiGet('/api/v1/me/telegram', telegramStatusSchema)
}

export async function createTelegramLinkToken(): Promise<TelegramLink> {
  return apiPost('/api/v1/me/telegram/link-token', undefined, telegramLinkSchema)
}

export async function disconnectTelegram(): Promise<void> {
  return apiDelete('/api/v1/me/telegram')
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
  return apiPut('/api/v1/me/notification-settings', settings, notificationSettingsSchema)
}
