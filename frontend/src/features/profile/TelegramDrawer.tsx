import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import {
  createTelegramLinkToken,
  disconnectTelegram,
  updateNotificationSettings,
  type NotificationSettingKey,
  type TelegramStatus,
} from '../../shared/api/notifications'
import { queryKeys } from '../../shared/api/queryKeys'
import { type ScheduleItem, type UserProfile, updateScheduleItemNotifications } from '../../shared/api/users'
import { ActionButton } from '../../shared/ui/ActionButton'
import { BottomDrawer, BottomDrawerActions, BottomDrawerContent, BottomDrawerList } from '../../shared/ui/BottomDrawer'
import { ConfirmDrawer } from '../../shared/ui/ConfirmDrawer'
import { DelayedSkeleton } from '../../shared/ui/DelayedSkeleton'

export type TelegramGroupNotificationItem = {
  item: ScheduleItem
  title: string
  loading: boolean
}

type TelegramDrawerProps = {
  open: boolean
  status?: TelegramStatus
  groups: TelegramGroupNotificationItem[]
  loading?: boolean
  error?: boolean
  onClose: () => void
}

export function TelegramDrawer({ open, status, groups, loading, error, onClose }: TelegramDrawerProps) {
  const queryClient = useQueryClient()
  const [renderedStatus, setRenderedStatus] = useState(status)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)
  const [pendingSettingKey, setPendingSettingKey] = useState<NotificationSettingKey | null>(null)
  const [pendingGroupItemId, setPendingGroupItemId] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setRenderedStatus(status)
    } else {
      setDisconnectConfirmOpen(false)
    }
  }, [open, status])

  const linkMutation = useMutation({
    mutationFn: createTelegramLinkToken,
    onSuccess: (link) => {
      window.location.href = link.url
    },
  })
  const disconnectMutation = useMutation({
    mutationFn: disconnectTelegram,
    onSuccess: async () => {
      setDisconnectConfirmOpen(false)
      onClose()
      await queryClient.invalidateQueries({ queryKey: queryKeys.telegramStatus() })
    },
  })
  const settingsMutation = useMutation({
    mutationFn: updateNotificationSettings,
    onMutate: async (nextSettings) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.telegramStatus() })
      const previousStatus = queryClient.getQueryData<TelegramStatus>(queryKeys.telegramStatus())
      queryClient.setQueryData<TelegramStatus>(queryKeys.telegramStatus(), (currentStatus) =>
        currentStatus ? { ...currentStatus, settings: nextSettings } : currentStatus,
      )
      return { previousStatus }
    },
    onError: (_error, _nextSettings, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(queryKeys.telegramStatus(), context.previousStatus)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.telegramStatus() })
      setPendingSettingKey(null)
    },
  })
  const groupNotificationsMutation = useMutation({
    mutationFn: ({ itemId, notificationsEnabled }: { itemId: string; notificationsEnabled: boolean }) =>
      updateScheduleItemNotifications(itemId, notificationsEnabled),
    onMutate: async ({ itemId, notificationsEnabled }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.me() })
      const previousProfile = queryClient.getQueryData<UserProfile>(queryKeys.me())
      queryClient.setQueryData<UserProfile>(queryKeys.me(), (profile) =>
        setScheduleItemNotifications(profile, itemId, notificationsEnabled),
      )
      return { previousProfile }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKeys.me(), context.previousProfile)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      setPendingGroupItemId(null)
    },
  })
  const connectedAccount = renderedStatus?.connected === true ? renderedStatus.account : null
  const settings = renderedStatus?.settings

  if (connectedAccount && settings) {
    return (
      <BottomDrawer open={open} onClose={onClose} title="Уведомления" height="90vh">
        <Stack sx={{ height: 1, minHeight: 0 }}>
          <BottomDrawerContent spacing={1.5} sx={{ pb: 2 }}>
            {error ? <Alert severity="error">Не удалось загрузить настройки уведомлений.</Alert> : null}
            {settingsMutation.isError || groupNotificationsMutation.isError ? (
              <Alert severity="error">Не удалось сохранить настройки уведомлений.</Alert>
            ) : null}
            {disconnectMutation.isError ? <Alert severity="error">Не удалось отключить Telegram.</Alert> : null}
          </BottomDrawerContent>
          <BottomDrawerList sx={{ flex: 1, minHeight: 0, px: 3 }}>
            <Stack component="li" spacing={2} sx={{ listStyle: 'none' }}>
              <NotificationSection title="Типы уведомлений">
                <NotificationSwitchRow
                  title="Новые занятия"
                  checked={settings.lesson_added_enabled}
                  disabled={pendingSettingKey === 'lesson_added_enabled'}
                  onChange={(checked) => updateSetting('lesson_added_enabled', checked)}
                />
                <NotificationSwitchRow
                  title="Отмены занятий"
                  checked={settings.lesson_removed_enabled}
                  disabled={pendingSettingKey === 'lesson_removed_enabled'}
                  onChange={(checked) => updateSetting('lesson_removed_enabled', checked)}
                />
                <NotificationSwitchRow
                  title="Переносы занятий"
                  checked={settings.time_changed_enabled}
                  disabled={pendingSettingKey === 'time_changed_enabled'}
                  onChange={(checked) => updateSetting('time_changed_enabled', checked)}
                />
                <NotificationSwitchRow
                  title="Замены аудиторий"
                  checked={settings.auditorium_changed_enabled}
                  disabled={pendingSettingKey === 'auditorium_changed_enabled'}
                  onChange={(checked) => updateSetting('auditorium_changed_enabled', checked)}
                />
                <NotificationSwitchRow
                  title="Замены преподавателей"
                  checked={settings.teacher_changed_enabled}
                  disabled={pendingSettingKey === 'teacher_changed_enabled'}
                  onChange={(checked) => updateSetting('teacher_changed_enabled', checked)}
                />
              </NotificationSection>
              <NotificationSection title="Группы">
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <NotificationSwitchRow
                      key={group.item.id}
                      title={group.loading ? <DelayedSkeleton show variant="text" width={128} /> : group.title}
                      checked={group.item.notifications_enabled}
                      disabled={pendingGroupItemId === group.item.id}
                      ariaLabel={`Уведомления ${group.title}`}
                      onChange={(checked) => {
                        setPendingGroupItemId(group.item.id)
                        groupNotificationsMutation.mutate({
                          itemId: group.item.id,
                          notificationsEnabled: checked,
                        })
                      }}
                    />
                  ))
                ) : (
                  <Box sx={{ py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Добавь группу в расписание, чтобы настроить уведомления
                    </Typography>
                  </Box>
                )}
              </NotificationSection>
            </Stack>
          </BottomDrawerList>
          <BottomDrawerActions>
            <Button
              variant="outlined"
              color="error"
              size="large"
              disabled={loading || disconnectMutation.isPending}
              onClick={() => setDisconnectConfirmOpen(true)}
              fullWidth
            >
              Отвязать аккаунт
            </Button>
          </BottomDrawerActions>
          <ConfirmDrawer
            open={disconnectConfirmOpen}
            onClose={() => setDisconnectConfirmOpen(false)}
            title="Отвязка Telegram"
            message={`Отвязать аккаунт ${formatTelegramAccount(connectedAccount)}?`}
            confirmLabel="Отвязать"
            confirmColor="error"
            confirmLoading={disconnectMutation.isPending}
            onConfirm={() => disconnectMutation.mutate()}
          />
        </Stack>
      </BottomDrawer>
    )
  }

  return (
    <BottomDrawer open={open} onClose={onClose} title="Уведомления">
      <BottomDrawerContent spacing={2.5}>
        <Typography variant="body1">
          Подключи Telegram, чтобы получать выбранные уведомления об изменениях расписания.
        </Typography>
        <ActionButton
          loading={linkMutation.isPending}
          disabled={loading}
          onClick={() => linkMutation.mutate()}
        >
          Подключить Telegram
        </ActionButton>
        {error ? <Alert severity="error">Не удалось загрузить настройки уведомлений.</Alert> : null}
        {linkMutation.isError ? <Alert severity="error">{linkMutation.error.message}</Alert> : null}
      </BottomDrawerContent>
    </BottomDrawer>
  )

  function updateSetting(key: NotificationSettingKey, checked: boolean) {
    if (!settings) {
      return
    }

    const nextSettings = { ...settings, [key]: checked }
    nextSettings.schedule_changes_enabled =
      nextSettings.lesson_added_enabled ||
      nextSettings.lesson_removed_enabled ||
      nextSettings.time_changed_enabled ||
      nextSettings.auditorium_changed_enabled ||
      nextSettings.teacher_changed_enabled
    setPendingSettingKey(key)
    settingsMutation.mutate(nextSettings)
  }
}

function formatTelegramAccount(account: NonNullable<TelegramStatus['account']>) {
  return account.telegram_username ? `@${account.telegram_username}` : `Chat ID ${account.telegram_chat_id}`
}

function setScheduleItemNotifications(
  profile: UserProfile | undefined,
  itemId: string,
  notificationsEnabled: boolean,
): UserProfile | undefined {
  if (!profile) {
    return profile
  }

  const updateItem = (item: ScheduleItem) =>
    item.id === itemId ? { ...item, notifications_enabled: notificationsEnabled } : item

  return {
    ...profile,
    primary_group: profile.primary_group ? updateItem(profile.primary_group) : null,
    favorites: profile.favorites.map(updateItem),
  }
}

function NotificationSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: 'action.hover',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        px: 2,
        py: 1.5,
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {title}
      </Typography>
      <Stack
        sx={{
          '& > * + *': {
            borderTop: 1,
            borderColor: 'divider',
          },
        }}
      >
        {children}
      </Stack>
    </Box>
  )
}

function NotificationSwitchRow({
  title,
  description,
  checked,
  disabled,
  ariaLabel,
  onChange,
}: {
  title: ReactNode
  description?: string
  checked: boolean
  disabled?: boolean
  ariaLabel?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <Box sx={{ py: 1.5 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack spacing={0.5} sx={{ minWidth: 0, pr: 1 }}>
          <Typography variant="body1" component="div">
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Stack>
        <Switch
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          slotProps={{ input: { 'aria-label': ariaLabel ?? (typeof title === 'string' ? title : 'Уведомление') } }}
        />
      </Stack>
    </Box>
  )
}
