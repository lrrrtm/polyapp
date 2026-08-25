import CheckIcon from '@mui/icons-material/Check'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { appConfig } from '../app/config'
import { type ThemePreference, useThemePreference } from '../app/theme-preference-context'
import { useUserPreferences } from '../app/user-preferences-context'
import { ApplicantCodeDrawer } from '../features/profile/ApplicantCodeDrawer'
import { GroupDrawer } from '../features/profile/GroupDrawer'
import { TelegramDrawer } from '../features/profile/TelegramDrawer'
import { getTelegramStatus } from '../shared/api/notifications'
import { queryKeys } from '../shared/api/queryKeys'
import { type Group, getGroupSchedule } from '../shared/api/ruz'
import { useRequiredUser } from '../shared/api/useRequiredUser'
import { getWeekStartDate, toIsoDate } from '../shared/date'
import { AppScreen } from '../shared/ui/AppScreen'
import { BottomDrawer } from '../shared/ui/BottomDrawer'
import { CenteredAlert } from '../shared/ui/CenteredAlert'
import { DelayedSkeleton } from '../shared/ui/DelayedSkeleton'
import { PageSkeleton } from '../shared/ui/PageSkeleton'
import { centeredFixedSurfaceSx } from '../shared/ui/layout'

const themePreferenceOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

export function SettingsPage() {
  const { themePreference, setThemePreference } = useThemePreference()
  const { hidePastLessons, setActiveScheduleItem, setHidePastLessons, showBreaks, setShowBreaks } = useUserPreferences()
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false)
  const [applicantDrawerOpen, setApplicantDrawerOpen] = useState(false)
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false)
  const [telegramDrawerOpen, setTelegramDrawerOpen] = useState(false)
  const currentWeekStartDate = useMemo(() => getWeekStartDate(toIsoDate(new Date())), [])
  const user = useRequiredUser()
  const primaryGroupId = user.status === 'ready' ? user.profile.primary_group?.ruz_id : undefined
  const currentGroupQuery = useQuery({
    queryKey: queryKeys.schedule('group', primaryGroupId, currentWeekStartDate),
    queryFn: () => getGroupSchedule(primaryGroupId ?? 0, currentWeekStartDate),
    enabled: primaryGroupId !== undefined,
  })
  const telegramQuery = useQuery({
    queryKey: queryKeys.telegramStatus(),
    queryFn: getTelegramStatus,
    enabled: user.status === 'ready',
  })
  const currentGroup = currentGroupQuery.data?.group ?? (primaryGroupId ? createGroupFallback(primaryGroupId) : null)

  if (user.status === 'loading') {
    return <PageSkeleton show />
  }

  if (user.status === 'error') {
    return <CenteredAlert message={user.errorMessage} />
  }

  if (user.status === 'anonymous') {
    return <Navigate to="/hello" replace />
  }

  const applicantCodeSubtitle = user.profile.applicant_code?.code ?? 'Не указан'
  const telegramStatus = telegramQuery.data
  const telegramConnected = telegramStatus?.connected === true
  const telegramSubtitle = telegramQuery.isPending ? (
    'Проверяем подключение'
  ) : telegramConnected ? (
    'Telegram подключён'
  ) : (
    'Telegram не подключён'
  )
  const currentGroupSubtitle = currentGroupQuery.isPending && primaryGroupId ? (
    <DelayedSkeleton show variant="text" width={104} />
  ) : (
    currentGroup?.name ?? (primaryGroupId ? `Группа ${primaryGroupId}` : 'Не указана')
  )

  return (
    <AppScreen>
      <Container
        component="main"
        maxWidth={false}
        sx={{
          ...centeredFixedSurfaceSx,
          height: '100%',
          overflowY: 'auto',
          pt: 3,
          pb: 10,
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="overline" component="h2" color="text.secondary">
              Общие
            </Typography>
            <List disablePadding>
              <SettingsRow
                title="Тема оформления"
                subtitle={formatThemePreference(themePreference)}
                onClick={() => setThemeDrawerOpen(true)}
              />
            </List>
          </Stack>
          {appConfig.VITE_ADMISSIONS_ENABLED ? (
            <Stack spacing={1}>
              <Typography variant="overline" component="h2" color="text.secondary">
                Поступление
              </Typography>
              <List disablePadding>
                <SettingsRow
                  title="Уникальный код поступающего"
                  subtitle={applicantCodeSubtitle}
                  onClick={() => setApplicantDrawerOpen(true)}
                />
              </List>
            </Stack>
          ) : null}
          <Stack spacing={1}>
            <Typography variant="overline" component="h2" color="text.secondary">
              Расписание
            </Typography>
            <List disablePadding>
              <SettingsRow
                title="Основная группа"
                subtitle={currentGroupSubtitle}
                onClick={() => setGroupDrawerOpen(true)}
              />
              <Divider component="li" />
              <SettingsRow
                title="Уведомления"
                subtitle={telegramSubtitle}
                onClick={() => setTelegramDrawerOpen(true)}
              />
              <Divider component="li" />
              <Stack
                component="li"
                direction="row"
                spacing={2}
                sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1.75 }}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography variant="body1">Показывать перерывы</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Между блоками занятий будет отображаться свободное время
                  </Typography>
                </Stack>
                <Switch
                  checked={showBreaks}
                  onChange={(event) => setShowBreaks(event.target.checked)}
                  slotProps={{ input: { 'aria-label': 'Показывать перерывы' } }}
                />
              </Stack>
              <Divider component="li" />
              <Stack
                component="li"
                direction="row"
                spacing={2}
                sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1.75 }}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography variant="body1">Скрывать прошедшие пары</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Будут отображаться только текущее и последующие занятия на сегодня
                  </Typography>
                </Stack>
                <Switch
                  checked={hidePastLessons}
                  onChange={(event) => setHidePastLessons(event.target.checked)}
                  slotProps={{ input: { 'aria-label': 'Скрывать прошедшие пары' } }}
                />
              </Stack>
            </List>
          </Stack>
        </Stack>
      </Container>
      <BottomDrawer
        open={themeDrawerOpen}
        onClose={() => setThemeDrawerOpen(false)}
        title="Тема оформления"
      >
        <List sx={{ pb: 2 }}>
          {themePreferenceOptions.map((option) => (
            <ListItemButton
              key={option.value}
              selected={option.value === themePreference}
              onClick={() => {
                setThemePreference(option.value)
                setThemeDrawerOpen(false)
              }}
            >
              <ListItemText primary={option.label} />
              {option.value === themePreference ? (
                <ListItemIcon sx={{ minWidth: 32, justifyContent: 'flex-end' }}>
                  <CheckIcon color="primary" />
                </ListItemIcon>
              ) : null}
            </ListItemButton>
          ))}
        </List>
      </BottomDrawer>
      {appConfig.VITE_ADMISSIONS_ENABLED ? (
        <ApplicantCodeDrawer
          open={applicantDrawerOpen}
          onClose={() => setApplicantDrawerOpen(false)}
          currentCode={user.profile.applicant_code?.code}
        />
      ) : null}
      <GroupDrawer
        open={groupDrawerOpen}
        onClose={() => setGroupDrawerOpen(false)}
        currentGroup={currentGroup}
        primaryGroupId={primaryGroupId}
        loading={currentGroupQuery.isFetching}
        error={currentGroupQuery.isError}
        onSaved={(group) => setActiveScheduleItem({ item_type: 'group', ruz_id: group.id })}
      />
      <TelegramDrawer
        open={telegramDrawerOpen}
        onClose={() => setTelegramDrawerOpen(false)}
        status={telegramStatus}
        loading={telegramQuery.isPending}
        error={telegramQuery.isError}
      />
    </AppScreen>
  )
}

function createGroupFallback(groupId: number): Group {
  return {
    id: groupId,
    name: `Группа ${groupId}`,
    level: null,
    type: null,
    kind: null,
    spec: '',
    year: null,
    faculty: null,
  }
}

function formatThemePreference(preference: ThemePreference): string {
  return themePreferenceOptions.find((option) => option.value === preference)?.label ?? 'Системная'
}

function SettingsRow({
  title,
  subtitle,
  onClick,
}: {
  title: string
  subtitle: ReactNode
  onClick: () => void
}) {
  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        px: 0,
        py: 1.75,
      }}
    >
      <ListItemText
        primary={title}
        secondary={subtitle}
        slotProps={{
          primary: { variant: 'body1' },
          secondary: { noWrap: true },
        }}
      />
      <ChevronRightIcon color="action" />
    </ListItemButton>
  )
}
