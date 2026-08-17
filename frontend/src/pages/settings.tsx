import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { type ThemePreference, useThemePreference } from '../app/theme-preference-context'
import { useUserPreferences } from '../app/user-preferences-context'
import { type Group, getGroupSchedule, searchGroups } from '../shared/api/ruz'
import { getCurrentUser, getSessionStatus, setPrimaryGroup } from '../shared/api/users'
import { getWeekStartDate, toIsoDate } from '../shared/date'
import { AppAutocomplete } from '../shared/ui/AppAutocomplete'
import { BottomDrawer } from '../shared/ui/BottomDrawer'
import { PageSkeleton } from '../shared/ui/PageSkeleton'
import { appMaxWidth } from '../shared/ui/layout'

const themePreferenceOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { themePreference, setThemePreference } = useThemePreference()
  const { hidePastLessons, setHidePastLessons, showBreaks, setShowBreaks } = useUserPreferences()
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false)
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false)
  const [confirmGroupDrawerOpen, setConfirmGroupDrawerOpen] = useState(false)
  const [pendingGroup, setPendingGroup] = useState<Group | null>(null)
  const [groupSearch, setGroupSearch] = useState('')
  const [debouncedGroupSearch, setDebouncedGroupSearch] = useState('')
  const currentWeekStartDate = useMemo(() => getWeekStartDate(toIsoDate(new Date())), [])
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSessionStatus,
  })
  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    enabled: sessionQuery.data?.hasUser === true,
  })
  const primaryGroupId = profileQuery.data?.primary_group?.ruz_id
  const currentGroupQuery = useQuery({
    queryKey: ['schedule', 'group', primaryGroupId, currentWeekStartDate],
    queryFn: () => getGroupSchedule(primaryGroupId ?? 0, currentWeekStartDate),
    enabled: primaryGroupId !== undefined,
  })
  const groupSearchQuery = useQuery({
    queryKey: ['groups-search', debouncedGroupSearch],
    queryFn: () => searchGroups(debouncedGroupSearch),
    enabled: groupDrawerOpen && debouncedGroupSearch.length > 0,
  })
  const currentGroup = currentGroupQuery.data?.group ?? (primaryGroupId ? createGroupFallback(primaryGroupId) : null)
  const groupOptions = useMemo(
    () => dedupeGroups([currentGroup, ...(groupSearchQuery.data ?? [])]),
    [currentGroup, groupSearchQuery.data],
  )
  const savePrimaryGroupMutation = useMutation({
    mutationFn: () => setPrimaryGroup(pendingGroup?.id ?? 0),
    onSuccess: async (profile) => {
      queryClient.setQueryData(['me'], profile)
      await queryClient.invalidateQueries({ queryKey: ['schedule'] })
      setConfirmGroupDrawerOpen(false)
      setPendingGroup(null)
    },
  })

  useEffect(() => {
    if (currentGroup && groupDrawerOpen && !confirmGroupDrawerOpen) {
      setGroupSearch(currentGroup.name)
      setDebouncedGroupSearch('')
    }
  }, [confirmGroupDrawerOpen, currentGroup, groupDrawerOpen])

  useEffect(() => {
    const trimmedSearch = groupSearch.trim()
    if (!trimmedSearch || trimmedSearch === currentGroup?.name) {
      setDebouncedGroupSearch('')
      return
    }

    const timeoutId = window.setTimeout(() => setDebouncedGroupSearch(trimmedSearch), 350)
    return () => window.clearTimeout(timeoutId)
  }, [currentGroup?.name, groupSearch])

  if (sessionQuery.isPending) {
    return <PageSkeleton show />
  }

  if (sessionQuery.isError) {
    return <CenteredAlert message="Не удалось проверить сессию." />
  }

  if (!sessionQuery.data.hasUser) {
    return <Navigate to="/hello" replace />
  }

  if (profileQuery.isPending) {
    return <PageSkeleton show />
  }

  if (profileQuery.isError) {
    return <CenteredAlert message="Не удалось загрузить профиль." />
  }

  if (!profileQuery.data.primary_group) {
    return <Navigate to="/register" replace />
  }

  return (
    <Box sx={{ height: '100svh', maxWidth: appMaxWidth, mx: 'auto', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Container
        component="main"
        maxWidth="sm"
        sx={{
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
          <Stack spacing={1}>
            <Typography variant="overline" component="h2" color="text.secondary">
              Расписание
            </Typography>
            <List disablePadding>
              <SettingsRow
                title="Учебная группа"
                subtitle={currentGroup?.name ?? `Группа ${primaryGroupId}`}
                onClick={() => setGroupDrawerOpen(true)}
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
                    Между блоками занятий будет отображаться свобдное время
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
      <BottomDrawer
        open={groupDrawerOpen}
        onClose={() => setGroupDrawerOpen(false)}
        title="Учебная группа"
      >
        <Stack spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }}>
          <AppAutocomplete
            options={groupOptions}
            value={currentGroup}
            label="Учебная группа"
            inputValue={groupSearch}
            loading={groupSearchQuery.isPending || currentGroupQuery.isPending}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText="Группы не найдены"
            error={groupSearchQuery.isError || currentGroupQuery.isError}
            helperText={groupSearchQuery.isError ? 'Не удалось найти группы.' : undefined}
            onChange={(value) => {
              if (!value || value.id === primaryGroupId) {
                return
              }

              setPendingGroup(value)
              setGroupDrawerOpen(false)
              setConfirmGroupDrawerOpen(true)
            }}
            onInputChange={setGroupSearch}
          />
        </Stack>
      </BottomDrawer>
      <BottomDrawer
        open={confirmGroupDrawerOpen}
        onClose={() => {
          setConfirmGroupDrawerOpen(false)
          setGroupDrawerOpen(true)
          setGroupSearch(currentGroup?.name ?? '')
        }}
        onExited={() => setPendingGroup(null)}
        title="Изменить группу?"
      >
        <Stack spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }}>
          <Stack spacing={0.75}>
            <Typography variant="body1">
              Сохранить новую учебную группу?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {pendingGroup?.name}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.25}>
            <Button
              variant="outlined"
              size="large"
              disabled={savePrimaryGroupMutation.isPending}
              onClick={() => {
                setConfirmGroupDrawerOpen(false)
                setGroupDrawerOpen(true)
                setGroupSearch(currentGroup?.name ?? '')
              }}
              fullWidth
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              size="large"
              disabled={!pendingGroup || pendingGroup.id === primaryGroupId}
              loading={savePrimaryGroupMutation.isPending}
              onClick={() => savePrimaryGroupMutation.mutate()}
              fullWidth
            >
              Сохранить
            </Button>
          </Stack>
          {savePrimaryGroupMutation.isError ? (
            <Alert severity="error">Не удалось сохранить группу. Попробуй ещё раз.</Alert>
          ) : null}
        </Stack>
      </BottomDrawer>
    </Box>
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

function dedupeGroups(groups: Array<Group | null | undefined>): Group[] {
  const seen = new Set<number>()
  return groups.filter((group): group is Group => {
    if (!group || seen.has(group.id)) {
      return false
    }

    seen.add(group.id)
    return true
  })
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
  subtitle: string
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

function CenteredAlert({ message }: { message: string }) {
  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <Alert severity="error">{message}</Alert>
    </Container>
  )
}
