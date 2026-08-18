import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  createTelegramLinkToken,
  disconnectTelegram,
  updateNotificationSettings,
  type NotificationSettingKey,
  type TelegramStatus,
} from '../../shared/api/notifications'
import { queryKeys } from '../../shared/api/queryKeys'
import { BottomDrawer } from '../../shared/ui/BottomDrawer'

type TelegramDrawerProps = {
  open: boolean
  status?: TelegramStatus
  loading?: boolean
  error?: boolean
  onClose: () => void
}

export function TelegramDrawer({ open, status, loading, error, onClose }: TelegramDrawerProps) {
  const queryClient = useQueryClient()
  const [renderedStatus, setRenderedStatus] = useState(status)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)
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
    },
  })
  const connectedAccount = renderedStatus?.connected === true ? renderedStatus.account : null
  const settings = renderedStatus?.settings

  if (connectedAccount && settings) {
    return (
      <BottomDrawer open={open} onClose={onClose} title="Уведомления" height="78vh">
        <Stack sx={{ height: 1, minHeight: 0 }}>
          <List sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, pb: 2 }}>
            <NotificationSwitchRow
              title="Новые пары"
              description="Когда в расписании появляется новое занятие"
              checked={settings.lesson_added_enabled}
              disabled={settingsMutation.isPending}
              onChange={(checked) => updateSetting('lesson_added_enabled', checked)}
            />
            <Divider component="li" />
            <NotificationSwitchRow
              title="Отмены занятий"
              description="Когда занятие исчезает из расписания"
              checked={settings.lesson_removed_enabled}
              disabled={settingsMutation.isPending}
              onChange={(checked) => updateSetting('lesson_removed_enabled', checked)}
            />
            <Divider component="li" />
            <NotificationSwitchRow
              title="Переносы"
              description="Когда меняется дата или время занятия"
              checked={settings.time_changed_enabled}
              disabled={settingsMutation.isPending}
              onChange={(checked) => updateSetting('time_changed_enabled', checked)}
            />
            <Divider component="li" />
            <NotificationSwitchRow
              title="Аудитории"
              description="Когда меняется аудитория занятия"
              checked={settings.auditorium_changed_enabled}
              disabled={settingsMutation.isPending}
              onChange={(checked) => updateSetting('auditorium_changed_enabled', checked)}
            />
            <Divider component="li" />
            <NotificationSwitchRow
              title="Преподаватели"
              description="Когда меняется преподаватель занятия"
              checked={settings.teacher_changed_enabled}
              disabled={settingsMutation.isPending}
              onChange={(checked) => updateSetting('teacher_changed_enabled', checked)}
            />
          </List>
          <Stack spacing={1.5} sx={{ px: 3, pb: 4, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Telegram подключён: {formatTelegramAccount(connectedAccount)}
            </Typography>
            {error ? <Alert severity="error">Не удалось загрузить настройки уведомлений.</Alert> : null}
            {settingsMutation.isError ? <Alert severity="error">Не удалось сохранить настройки уведомлений.</Alert> : null}
            {disconnectMutation.isError ? <Alert severity="error">Не удалось отключить Telegram.</Alert> : null}
            <Button
              variant="outlined"
              color="error"
              size="large"
              disabled={loading || settingsMutation.isPending}
              onClick={() => setDisconnectConfirmOpen(true)}
              fullWidth
            >
              Отвязать
            </Button>
          </Stack>
          <BottomDrawer
            open={disconnectConfirmOpen}
            onClose={() => setDisconnectConfirmOpen(false)}
            title="Отвязка Telegram"
          >
            <Stack spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }}>
              <Typography variant="body1">Отвязать аккаунт {formatTelegramAccount(connectedAccount)}?</Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  size="large"
                  disabled={disconnectMutation.isPending}
                  onClick={() => setDisconnectConfirmOpen(false)}
                  fullWidth
                >
                  Отмена
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  loading={disconnectMutation.isPending}
                  onClick={() => disconnectMutation.mutate()}
                  fullWidth
                >
                  Отвязать
                </Button>
              </Stack>
            </Stack>
          </BottomDrawer>
        </Stack>
      </BottomDrawer>
    )
  }

  return (
    <BottomDrawer open={open} onClose={onClose} title="Уведомления">
      <Stack spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }}>
        <Typography variant="body1">
          Подключи Telegram, чтобы получать выбранные уведомления об изменениях расписания.
        </Typography>
        <Button
          variant="contained"
          size="large"
          loading={linkMutation.isPending}
          disabled={loading}
          onClick={() => linkMutation.mutate()}
          fullWidth
        >
          Подключить Telegram
        </Button>
        {error ? <Alert severity="error">Не удалось загрузить настройки уведомлений.</Alert> : null}
        {linkMutation.isError ? <Alert severity="error">{linkMutation.error.message}</Alert> : null}
      </Stack>
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
    settingsMutation.mutate(nextSettings)
  }
}

function formatTelegramAccount(account: NonNullable<TelegramStatus['account']>) {
  return account.telegram_username ? `@${account.telegram_username}` : `Chat ID ${account.telegram_chat_id}`
}

function NotificationSwitchRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Box component="li" sx={{ py: 1.75, opacity: disabled ? 0.62 : 1 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack spacing={0.5} sx={{ minWidth: 0, pr: 1 }}>
          <Typography variant="body1">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Stack>
        <Switch
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          slotProps={{ input: { 'aria-label': title } }}
        />
      </Stack>
    </Box>
  )
}
