import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import IconButton from '@mui/material/IconButton'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import PersonIcon from '@mui/icons-material/Person'
import PlaceIcon from '@mui/icons-material/Place'
import Popover from '@mui/material/Popover'
import SchoolIcon from '@mui/icons-material/School'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { keyframes } from '@mui/material/styles'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { useUserPreferences } from '../app/user-preferences-context'
import { getBuildingMapLinks } from '../shared/api/buildings'
import {
  type Group,
  type GroupSchedule,
  getGroupSchedule,
  getTeacherSchedule,
  searchGroups,
  searchTeachers,
  type Teacher,
  type TeacherSchedule,
} from '../shared/api/ruz'
import { addFavorite, getCurrentUser, getSessionStatus, type ScheduleItem } from '../shared/api/users'
import { addDays, formatLessonTime, formatScheduleHeaderDate, getWeekStartDate, toIsoDate } from '../shared/date'
import { BottomDrawer } from '../shared/ui/BottomDrawer'
import { DelayedSkeleton } from '../shared/ui/DelayedSkeleton'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageSkeleton } from '../shared/ui/PageSkeleton'
import { appMaxWidth, centeredFixedSurfaceSx } from '../shared/ui/layout'

type Schedule = GroupSchedule | TeacherSchedule
type Lesson = Schedule['days'][number]['lessons'][number]
type SearchResult = {
  itemType: ScheduleItem['item_type']
  ruzId: number
  title: string
  subtitle: string
}

const activeLessonPulse = keyframes`
  0%, 100% {
    background-color: rgba(86, 150, 91, 0.12);
  }
  50% {
    background-color: rgba(86, 150, 91, 0.24);
  }
`

export function SchedulePage() {
  const queryClient = useQueryClient()
  const {
    activeScheduleItem: storedActiveScheduleItem,
    hidePastLessons,
    setActiveScheduleItem,
    showBreaks,
  } = useUserPreferences()
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()))
  const [dateAnchor, setDateAnchor] = useState<HTMLButtonElement | null>(null)
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false)
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [debouncedScheduleSearch, setDebouncedScheduleSearch] = useState('')
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const swipeStartX = useRef<number | null>(null)

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSessionStatus,
  })
  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    enabled: sessionQuery.data?.hasUser === true,
  })
  const scheduleItems = useMemo(
    () => dedupeScheduleItems([profileQuery.data?.primary_group, ...(profileQuery.data?.favorites ?? [])]),
    [profileQuery.data?.favorites, profileQuery.data?.primary_group],
  )
  const activeScheduleItem =
    scheduleItems.find(
      (item) => item.item_type === storedActiveScheduleItem?.item_type && item.ruz_id === storedActiveScheduleItem.ruz_id,
    ) ?? profileQuery.data?.primary_group
  const selectedWeekStartDate = useMemo(() => getWeekStartDate(selectedDate), [selectedDate])
  const activeScheduleQuery = useQuery({
    queryKey: activeScheduleItem ? getScheduleQueryKey(activeScheduleItem, selectedWeekStartDate) : ['schedule', 'empty'],
    queryFn: () => fetchSchedule(activeScheduleItem as ScheduleItem, selectedWeekStartDate),
    enabled: activeScheduleItem !== undefined,
  })
  const buildingMapLinksQuery = useQuery({
    queryKey: ['building-map-links'],
    queryFn: getBuildingMapLinks,
  })
  const buildingMapLinksById = useMemo(
    () => new Map((buildingMapLinksQuery.data ?? []).map((link) => [link.building_id, link])),
    [buildingMapLinksQuery.data],
  )
  const scheduleItemQueries = useQueries({
    queries: scheduleItems.map((item) => ({
      queryKey: getScheduleQueryKey(item, selectedWeekStartDate),
      queryFn: () => fetchSchedule(item, selectedWeekStartDate),
      enabled: scheduleDrawerOpen,
    })),
  })
  const selectedDay = useMemo(
    () => activeScheduleQuery.data?.days.find((day) => day.date === selectedDate),
    [activeScheduleQuery.data?.days, selectedDate],
  )
  const visibleLessons = useMemo(() => {
    if (!selectedDay) {
      return []
    }

    if (!hidePastLessons || selectedDate !== toIsoDate(now)) {
      return selectedDay.lessons
    }

    return selectedDay.lessons.filter((lesson) => !isLessonPast(lesson.time_end, now))
  }, [hidePastLessons, now, selectedDate, selectedDay])
  const hasSelectedDayLessons = visibleLessons.length > 0
  const filteredScheduleItems = useMemo(
    () =>
      scheduleItems.filter((item, index) => {
        const query = scheduleSearch.trim().toLowerCase()
        if (!query) {
          return true
        }

        const schedule = scheduleItemQueries[index]?.data
        return getScheduleTitle(item, schedule).toLowerCase().includes(query)
      }),
    [scheduleItemQueries, scheduleItems, scheduleSearch],
  )
  const trimmedScheduleSearch = scheduleSearch.trim()
  useEffect(() => {
    if (!trimmedScheduleSearch) {
      setDebouncedScheduleSearch('')
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedScheduleSearch(trimmedScheduleSearch)
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [trimmedScheduleSearch])

  const favoriteSearchQuery = debouncedScheduleSearch
  const isSearchSettled = trimmedScheduleSearch === favoriteSearchQuery
  const shouldSearchRuz = scheduleDrawerOpen && favoriteSearchQuery.length > 0
  const groupSearchQuery = useQuery({
    queryKey: ['groups-search', favoriteSearchQuery],
    queryFn: () => searchGroups(favoriteSearchQuery),
    enabled: shouldSearchRuz,
  })
  const teacherSearchQuery = useQuery({
    queryKey: ['teachers-search', favoriteSearchQuery],
    queryFn: () => searchTeachers(favoriteSearchQuery),
    enabled: shouldSearchRuz,
  })
  const searchResults = useMemo(
    () =>
      [
        ...(groupSearchQuery.data ?? []).map(groupToSearchResult),
        ...(teacherSearchQuery.data ?? []).map(teacherToSearchResult),
      ].filter((result) => !isScheduleItemSaved(scheduleItems, result.itemType, result.ruzId)),
    [groupSearchQuery.data, scheduleItems, teacherSearchQuery.data],
  )
  const isExternalSearchPending = shouldSearchRuz && (!isSearchSettled || groupSearchQuery.isPending || teacherSearchQuery.isPending)
  const isExternalSearchReady =
    shouldSearchRuz &&
    isSearchSettled &&
    !groupSearchQuery.isPending &&
    !teacherSearchQuery.isPending &&
    !groupSearchQuery.isError &&
    !teacherSearchQuery.isError
  const addFavoriteMutation = useMutation({
    mutationFn: (result: SearchResult) => addFavorite(result.itemType, result.ruzId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      setScheduleSearch('')
      setDebouncedScheduleSearch('')
    },
  })
  const activeScheduleTitle = getScheduleTitle(activeScheduleItem, activeScheduleQuery.data)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  function moveSelectedDate(days: number) {
    setSelectedDate((currentDate) => addDays(currentDate, days))
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    swipeStartX.current = event.clientX
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (swipeStartX.current === null) {
      return
    }

    const deltaX = event.clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(deltaX) < 60) {
      return
    }

    moveSelectedDate(deltaX < 0 ? 1 : -1)
  }

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
      <AppBar
        position="absolute"
        color="default"
        elevation={0}
        sx={{ ...centeredFixedSurfaceSx, borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar
          sx={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 40px',
            columnGap: 1,
            minHeight: 56,
          }}
        >
          <IconButton
            color="inherit"
            aria-label="Предыдущий день"
            onClick={() => moveSelectedDate(-1)}
            sx={{ justifySelf: 'start' }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Button
            color="inherit"
            onClick={(event) => setDateAnchor(event.currentTarget)}
            sx={{
              justifySelf: 'center',
              minWidth: 0,
              px: 1,
              textAlign: 'center',
              textTransform: 'none',
              userSelect: 'none',
            }}
          >
            <Typography variant="subtitle1" component="h1" sx={{ fontWeight: 600 }}>
              {formatScheduleHeaderDate(selectedDate)}
            </Typography>
          </Button>
          <IconButton
            color="inherit"
            aria-label="Следующий день"
            onClick={() => moveSelectedDate(1)}
            sx={{ justifySelf: 'end' }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Popover
        open={dateAnchor !== null}
        anchorEl={dateAnchor}
        onClose={() => setDateAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <DateCalendar
          value={dayjs(selectedDate)}
          onChange={(value) => {
            if (value?.isValid()) {
              setSelectedDate(value.format('YYYY-MM-DD'))
              setDateAnchor(null)
            }
          }}
        />
      </Popover>
      <Container
        component="main"
        maxWidth="sm"
        sx={{
          position: 'absolute',
          top: 56,
          bottom: 112,
          left: 0,
          right: 0,
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflowY: hasSelectedDayLessons ? 'auto' : 'hidden',
          py: 0,
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <Stack sx={{ flex: 1, touchAction: 'pan-y' }}>
          {activeScheduleQuery.isPending ? <ScheduleLoading show /> : null}
          {activeScheduleQuery.isError ? <Alert severity="error">Не удалось загрузить расписание.</Alert> : null}
          {activeScheduleQuery.isSuccess && visibleLessons.length === 0 ? (
            <EmptyState icon={EventBusyIcon} title="На этот день занятий нет" sx={{ flex: 1, minHeight: 0 }} />
          ) : null}
          {visibleLessons.map((lesson, index) => {
            const nextLesson = visibleLessons[index + 1]
            const breakMinutes = nextLesson ? getBreakDurationMinutes(lesson, nextLesson) : 0
            const auditories = lesson.auditories.map(formatAuditorium).join(', ')
            const teachers = lesson.teachers?.map((teacher) => teacher.full_name).join(', ')
            const lessonType = lesson.typeObj?.name || lesson.typeObj?.abbr || 'Занятие'
            const timeStart = formatLessonTime(lesson.time_start)
            const timeEnd = formatLessonTime(lesson.time_end)
            const activeLesson = isLessonActive(lesson.time_start, lesson.time_end, now)

            return (
              <Box key={`${lesson.subject}-${lesson.time_start}-${index}`}>
                <ButtonBase
                  onClick={() => {
                    setSelectedLesson(lesson)
                    setLessonDrawerOpen(true)
                  }}
                  sx={{
                    display: 'block',
                    width: 1,
                    borderRadius: 2,
                    textAlign: 'left',
                    '&:focus-visible': {
                      outline: 2,
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Stack spacing={1.5} sx={{ py: 2 }}>
                    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {lessonType}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={
                          activeLesson
                            ? {
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                animation: `${activeLessonPulse} 1.8s ease-in-out infinite`,
                                color: 'primary.dark',
                              }
                            : undefined
                        }
                      >
                        {timeStart}
                        {timeEnd ? ` - ${timeEnd}` : ''}
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
                        {lesson.subject}
                      </Typography>
                      {teachers ? (
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <PersonIcon color="action" fontSize="small" />
                          <Typography variant="body2">{teachers}</Typography>
                        </Stack>
                      ) : null}
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <PlaceIcon color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">
                          {auditories || 'Аудитория не указана'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </ButtonBase>
                {index < visibleLessons.length - 1 ? (
                  showBreaks && breakMinutes > 0 ? (
                    <BreakRow minutes={breakMinutes} />
                  ) : (
                    <Divider />
                  )
                ) : null}
              </Box>
            )
          })}
        </Stack>
      </Container>
      <AppBar
        position="absolute"
        color="default"
        elevation={0}
        sx={{ ...centeredFixedSurfaceSx, top: 'auto', bottom: 56, borderTop: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ minHeight: 56 }}>
          <Button
            color="inherit"
            fullWidth
            onClick={() => setScheduleDrawerOpen(true)}
            sx={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 32px',
              minWidth: 0,
              py: 0.75,
              textAlign: 'center',
              textTransform: 'none',
            }}
          >
            <Box />
            <Typography variant="body1" noWrap>
              {activeScheduleTitle}
            </Typography>
            <KeyboardArrowUpIcon sx={{ justifySelf: 'end' }} />
          </Button>
        </Toolbar>
      </AppBar>
      <BottomDrawer
        open={scheduleDrawerOpen}
        onClose={() => setScheduleDrawerOpen(false)}
        title="Избранное"
        height="70vh"
      >
        <Stack sx={{ height: 1 }}>
          <Box sx={{ px: 2, pb: 1 }}>
            <TextField
              fullWidth
              label="Поиск"
              value={scheduleSearch}
              onChange={(event) => setScheduleSearch(event.target.value)}
              placeholder="Группа или преподаватель"
              size="small"
            />
          </Box>
          <List sx={{ overflowY: 'auto', pb: 2 }}>
            {filteredScheduleItems.map((item) => {
              const index = scheduleItems.findIndex(
                (scheduleItem) => scheduleItem.item_type === item.item_type && scheduleItem.ruz_id === item.ruz_id,
              )
              const schedule = index >= 0 ? scheduleItemQueries[index]?.data : undefined
              const itemLoading = index >= 0 && scheduleItemQueries[index]?.isPending === true
              const isSelected =
                item.item_type === activeScheduleItem?.item_type && item.ruz_id === activeScheduleItem?.ruz_id

              return (
                <ListItemButton
                  key={`${item.item_type}-${item.ruz_id}`}
                  selected={isSelected}
                  onClick={() => {
                    setActiveScheduleItem(item)
                    setScheduleDrawerOpen(false)
                  }}
                >
                  <ListItemIcon>
                    {item.item_type === 'teacher' ? <PersonIcon color="action" /> : <SchoolIcon color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      itemLoading ? (
                        <DelayedSkeleton show variant="text" width="55%" />
                      ) : (
                        <Typography noWrap>{getScheduleTitle(item, schedule)}</Typography>
                      )
                    }
                    secondary={
                      itemLoading ? (
                        <DelayedSkeleton show variant="text" width="75%" />
                      ) : (
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {getScheduleSubtitle(item, schedule)}
                        </Typography>
                      )
                    }
                  />
                </ListItemButton>
              )
            })}
            {isExternalSearchPending ? (
              <SearchResultsLoading show />
            ) : null}
            {shouldSearchRuz && isSearchSettled && (groupSearchQuery.isError || teacherSearchQuery.isError) ? (
              <Box sx={{ px: 2, py: 1 }}>
                <Alert severity="error">Не удалось выполнить поиск.</Alert>
              </Box>
            ) : null}
            {isExternalSearchReady && searchResults.length > 0
              ? searchResults.map((result) => (
                  <ListItemButton
                    key={`${result.itemType}-${result.ruzId}`}
                    sx={{ position: 'relative', pr: 7 }}
                    onClick={() => addFavoriteMutation.mutate(result)}
                  >
                    <ListItemIcon>
                      {result.itemType === 'teacher' ? <PersonIcon color="action" /> : <SchoolIcon color="action" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography noWrap>{result.title}</Typography>}
                      secondary={
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {result.subtitle}
                        </Typography>
                      }
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', position: 'absolute', right: 16 }}>
                      <IconButton
                        aria-label="Добавить в избранное"
                        disabled={addFavoriteMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          addFavoriteMutation.mutate(result)
                        }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </ListItemButton>
                ))
              : null}
            {shouldSearchRuz && addFavoriteMutation.isError ? (
              <Box sx={{ px: 2, py: 1 }}>
                <Alert severity="error">Не удалось добавить в избранное.</Alert>
              </Box>
            ) : null}
            {isExternalSearchReady &&
            filteredScheduleItems.length === 0 &&
            searchResults.length === 0 ? (
              <EmptyState icon={SearchOffIcon} title="Ничего не найдено" sx={{ minHeight: 280 }} />
            ) : null}
          </List>
        </Stack>
      </BottomDrawer>
      <LessonDetailsDrawer
        open={lessonDrawerOpen}
        lesson={selectedLesson}
        mapUrl={selectedLesson ? getLessonMapUrl(selectedLesson, buildingMapLinksById) : undefined}
        onClose={() => setLessonDrawerOpen(false)}
        onExited={() => setSelectedLesson(null)}
      />
    </Box>
  )
}

function getScheduleQueryKey(item: ScheduleItem, date: string) {
  return ['schedule', item.item_type, item.ruz_id, date] as const
}

function fetchSchedule(item: ScheduleItem, date: string): Promise<Schedule> {
  if (item.item_type === 'teacher') {
    return getTeacherSchedule(item.ruz_id, date)
  }

  return getGroupSchedule(item.ruz_id, date)
}

function dedupeScheduleItems(items: Array<ScheduleItem | null | undefined>): ScheduleItem[] {
  const seen = new Set<string>()
  return items.filter((item): item is ScheduleItem => {
    if (!item) {
      return false
    }

    const key = `${item.item_type}:${item.ruz_id}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function getScheduleTitle(item: ScheduleItem | null | undefined, schedule: Schedule | undefined): string {
  if (!item) {
    return 'Расписание'
  }

  if (item.item_type === 'teacher') {
    return schedule && 'teacher' in schedule ? schedule.teacher.full_name : `Преподаватель ${item.ruz_id}`
  }

  return schedule && 'group' in schedule ? schedule.group.name : `Группа ${item.ruz_id}`
}

function getScheduleSubtitle(item: ScheduleItem | null | undefined, schedule: Schedule | undefined): string {
  if (!item || !schedule) {
    return ''
  }

  if (item.item_type === 'teacher') {
    return 'teacher' in schedule ? formatChair(schedule.teacher.chair) : ''
  }

  return 'group' in schedule ? (schedule.group.faculty?.abbr ?? '') : ''
}

function groupToSearchResult(group: Group): SearchResult {
  return {
    itemType: 'group',
    ruzId: group.id,
    title: group.name,
    subtitle: group.faculty?.abbr ?? '',
  }
}

function teacherToSearchResult(teacher: Teacher): SearchResult {
  return {
    itemType: 'teacher',
    ruzId: teacher.id,
    title: teacher.full_name,
    subtitle: formatChair(teacher.chair),
  }
}

function formatChair(chair: string | undefined): string {
  return chair?.replace(/^\d+(?:\/\d+)?\s+/, '') ?? ''
}

function formatAuditorium(auditorium: { name: string; building: { abbr: string; name: string } }): string {
  const building = auditorium.building.name
  const room = /^\d+$/.test(auditorium.name) ? `ауд. ${auditorium.name}` : auditorium.name
  return building ? `${room}, ${building}` : room
}

function getLessonMapUrl(lesson: Lesson, buildingMapLinksById: Map<number, { yandex_maps_url: string }>): string | undefined {
  return lesson.auditories
    .map((auditorium) => buildingMapLinksById.get(auditorium.building.id)?.yandex_maps_url)
    .find((url): url is string => Boolean(url))
}

function isLessonActive(timeStart: string | null, timeEnd: string | null, now: Date): boolean {
  if (!timeStart || !timeEnd) {
    return false
  }

  const start = new Date(timeStart).getTime()
  const end = new Date(timeEnd).getTime()
  const current = now.getTime()
  return current >= start && current <= end
}

function isLessonPast(timeEnd: string | null, now: Date): boolean {
  if (!timeEnd) {
    return false
  }

  return new Date(timeEnd).getTime() < now.getTime()
}

function getBreakDurationMinutes(previousLesson: Lesson, nextLesson: Lesson): number {
  if (!previousLesson.time_end || !nextLesson.time_start) {
    return 0
  }

  const previousEnd = new Date(previousLesson.time_end).getTime()
  const nextStart = new Date(nextLesson.time_start).getTime()
  const diffMinutes = Math.round((nextStart - previousEnd) / 60_000)
  return diffMinutes > 0 ? diffMinutes : 0
}

function formatBreakDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} мин`
  }

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes > 0 ? `${hours} ч ${restMinutes} мин` : `${hours} ч`
}

function isScheduleItemSaved(
  items: ScheduleItem[],
  itemType: ScheduleItem['item_type'],
  ruzId: number,
): boolean {
  return items.some((item) => item.item_type === itemType && item.ruz_id === ruzId)
}

function ScheduleLoading({ show }: { show: boolean }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <Box key={index}>
          <Stack spacing={1.5} sx={{ py: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <DelayedSkeleton show={show} variant="text" width="22%" />
              <DelayedSkeleton show={show} variant="text" width="30%" />
            </Stack>
            <Stack spacing={1}>
              <DelayedSkeleton show={show} variant="text" width="82%" height={32} />
              <DelayedSkeleton show={show} variant="text" width="62%" />
              <DelayedSkeleton show={show} variant="text" width="48%" />
            </Stack>
          </Stack>
          {index < 2 ? <Divider /> : null}
        </Box>
      ))}
    </>
  )
}

function BreakRow({ minutes }: { minutes: number }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1 }}>
      <Divider sx={{ flex: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        Перерыв {formatBreakDuration(minutes)}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Stack>
  )
}

function SearchResultsLoading({ show }: { show: boolean }) {
  return (
    <Stack spacing={0.5} sx={{ py: 1 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ alignItems: 'center', px: 2, py: 1 }}>
          <DelayedSkeleton show={show} variant="circular" width={24} height={24} />
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <DelayedSkeleton show={show} variant="text" width="65%" />
            <DelayedSkeleton show={show} variant="text" width="85%" />
          </Stack>
          <DelayedSkeleton show={show} variant="text" width={24} height={32} />
        </Stack>
      ))}
    </Stack>
  )
}

function LessonDetailsDrawer({
  open,
  lesson,
  mapUrl,
  onClose,
  onExited,
}: {
  open: boolean
  lesson: Lesson | null
  mapUrl: string | undefined
  onClose: () => void
  onExited: () => void
}) {
  const lessonType = lesson?.typeObj?.name || lesson?.typeObj?.abbr || 'Занятие'
  const timeStart = formatLessonTime(lesson?.time_start ?? null)
  const timeEnd = formatLessonTime(lesson?.time_end ?? null)
  const teachers = lesson?.teachers?.map((teacher) => teacher.full_name).join(', ')
  const auditories = lesson?.auditories.map(formatAuditorium).join(', ')
  const lmsUrl = normalizeUrl(lesson?.lms_url)
  const webinarUrl = normalizeUrl(lesson?.webinar_url)

  return (
    <BottomDrawer
      open={open}
      onClose={onClose}
      onExited={onExited}
      maxHeight="80vh"
    >
      <Stack spacing={2.5} sx={{ px: 3, pt: 2, pb: 4 }}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {lessonType}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {timeStart}
            {timeEnd ? ` - ${timeEnd}` : ''}
          </Typography>
        </Stack>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
          {lesson?.subject}
        </Typography>
        <Stack spacing={1.25}>
          {teachers ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <PersonIcon color="action" fontSize="small" />
              <Typography variant="body2">{teachers}</Typography>
            </Stack>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <PlaceIcon color="action" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {auditories || 'Аудитория не указана'}
            </Typography>
          </Stack>
        </Stack>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1.25}>
            <Button
              variant="contained"
              size="large"
              disabled={!lmsUrl}
              onClick={() => openExternalUrl(lmsUrl)}
              fullWidth
            >
              СДО
            </Button>
            <Button
              variant="contained"
              size="large"
              disabled={!webinarUrl}
              onClick={() => openExternalUrl(webinarUrl)}
              fullWidth
            >
              Вебинар
            </Button>
          </Stack>
          <Button
            variant="outlined"
            size="large"
            disabled={!mapUrl}
            onClick={() => openExternalUrl(mapUrl)}
            fullWidth
          >
            Маршрут до корпуса
          </Button>
        </Stack>
      </Stack>
    </BottomDrawer>
  )
}

function normalizeUrl(url: string | null | undefined): string | undefined {
  const trimmedUrl = url?.trim()
  return trimmedUrl ? trimmedUrl : undefined
}

function openExternalUrl(url: string | undefined) {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function CenteredAlert({ message }: { message: string }) {
  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <Alert severity="error">{message}</Alert>
    </Container>
  )
}
