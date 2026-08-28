import SchoolIcon from '@mui/icons-material/School'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Navigate } from 'react-router'
import { useUserPreferences } from '../app/user-preferences-context'
import { GroupDrawer } from '../features/profile/GroupDrawer'
import { getBuildingMapLinks } from '../shared/api/buildings'
import { queryKeys } from '../shared/api/queryKeys'
import { getScheduleChanges } from '../shared/api/scheduleChanges'
import { useRequiredUser } from '../shared/api/useRequiredUser'
import { addDays, getWeekStartDate, isSunday, toIsoDate } from '../shared/date'
import { vibrateTap } from '../shared/haptics'
import { AppScreen } from '../shared/ui/AppScreen'
import { CenteredAlert } from '../shared/ui/CenteredAlert'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageSkeleton } from '../shared/ui/PageSkeleton'
import { LessonDetailsDrawer } from './schedule/LessonDetailsDrawer'
import { ScheduleFavoritesDrawer } from './schedule/ScheduleFavoritesDrawer'
import { ScheduleHeader } from './schedule/ScheduleHeader'
import { ScheduleHeaderTour } from './schedule/ScheduleHeaderTour'
import { ScheduleList } from './schedule/ScheduleList'
import { SwipeableScheduleViewport, type SwipeableScheduleViewportHandle } from './schedule/SwipeableScheduleViewport'
import {
  buildScheduleLessonItems,
  createDemoScheduleChanges,
  type ScheduleLessonItem,
} from './schedule/schedule-change-utils'
import { fetchSchedule, getLessonMapUrl, isBreakActive, isLessonPast, type Schedule } from './schedule/schedule-utils'
import { useActiveSchedule } from './schedule/useActiveSchedule'
import { useScheduleSearch } from './schedule/useScheduleSearch'

export function SchedulePage() {
  const {
    activeScheduleItem: storedActiveScheduleItem,
    hidePastLessons,
    setActiveScheduleItem,
    showBreaks,
  } = useUserPreferences()
  const user = useRequiredUser()
  const [selectedDate, setSelectedDate] = useState(() => getScheduleDate(toIsoDate(new Date())))
  const [dateAnchor, setDateAnchor] = useState<HTMLButtonElement | null>(null)
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false)
  const [primaryGroupDrawerOpen, setPrimaryGroupDrawerOpen] = useState(false)
  const [selectedLessonItem, setSelectedLessonItem] = useState<ScheduleLessonItem | null>(null)
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false)
  const [scheduleTourActive, setScheduleTourActive] = useState(false)
  const [calendarAnimation, setCalendarAnimation] = useState<{ date: string; direction: -1 | 1 } | null>(null)
  const [lastKnownActiveScheduleTitle, setLastKnownActiveScheduleTitle] = useState('Расписание')
  const [now, setNow] = useState(() => new Date())
  const scheduleViewportRef = useRef<SwipeableScheduleViewportHandle | null>(null)

  const profile = user.status === 'ready' ? user.profile : null
  const {
    scheduleItems,
    activeScheduleItem,
    activeScheduleQuery,
    scheduleItemQueries,
    selectedWeekStartDate,
    activeScheduleTitle,
  } = useActiveSchedule(
    profile,
    storedActiveScheduleItem,
    selectedDate,
    scheduleDrawerOpen,
  )
  const {
    scheduleSearch,
    setScheduleSearch,
    filteredScheduleItems,
    searchResults,
    isExternalSearchPending,
    isExternalSearchReady,
    searchError,
    shouldSearchRuz,
    addFavoriteMutation,
    deleteFavoriteMutation,
  } = useScheduleSearch(scheduleDrawerOpen, scheduleItems, scheduleItemQueries, (item) => {
    if (item.item_type !== activeScheduleItem?.item_type || item.ruz_id !== activeScheduleItem.ruz_id) {
      return
    }

    setActiveScheduleItem(profile?.primary_group ? { item_type: 'group', ruz_id: profile.primary_group.ruz_id } : null)
  })
  const buildingMapLinksQuery = useQuery({
    queryKey: queryKeys.buildingMapLinks(),
    queryFn: getBuildingMapLinks,
  })
  const scheduleChangesQuery = useQuery({
    queryKey: queryKeys.scheduleChanges(),
    queryFn: getScheduleChanges,
    enabled: user.status === 'ready',
  })
  const previousDate = getScheduleDate(addDays(selectedDate, -1), -1)
  const nextDate = getScheduleDate(addDays(selectedDate, 1), 1)
  const previousWeekStartDate = getWeekStartDate(previousDate)
  const nextWeekStartDate = getWeekStartDate(nextDate)
  const shouldLoadPreviousWeek = activeScheduleItem !== null && activeScheduleItem !== undefined && previousWeekStartDate !== selectedWeekStartDate
  const shouldLoadNextWeek = activeScheduleItem !== null && activeScheduleItem !== undefined && nextWeekStartDate !== selectedWeekStartDate
  const calendarAnimationWeekStartDate = calendarAnimation ? getWeekStartDate(calendarAnimation.date) : selectedWeekStartDate
  const previousWeekQuery = useQuery({
    queryKey: activeScheduleItem
      ? queryKeys.schedule(activeScheduleItem.item_type, activeScheduleItem.ruz_id, previousWeekStartDate)
      : queryKeys.scheduleEmpty(),
    queryFn: () => fetchScheduleOrThrow(activeScheduleItem, previousWeekStartDate),
    enabled: shouldLoadPreviousWeek,
  })
  const nextWeekQuery = useQuery({
    queryKey: activeScheduleItem
      ? queryKeys.schedule(activeScheduleItem.item_type, activeScheduleItem.ruz_id, nextWeekStartDate)
      : queryKeys.scheduleEmpty(),
    queryFn: () => fetchScheduleOrThrow(activeScheduleItem, nextWeekStartDate),
    enabled: shouldLoadNextWeek,
  })
  const calendarAnimationWeekQuery = useQuery({
    queryKey: activeScheduleItem
      ? queryKeys.schedule(activeScheduleItem.item_type, activeScheduleItem.ruz_id, calendarAnimationWeekStartDate)
      : queryKeys.scheduleEmpty(),
    queryFn: () => fetchScheduleOrThrow(activeScheduleItem, calendarAnimationWeekStartDate),
    enabled: activeScheduleItem !== null && activeScheduleItem !== undefined && calendarAnimation !== null,
  })
  const buildingMapLinksById = useMemo(
    () => new Map((buildingMapLinksQuery.data ?? []).map((link) => [link.building_id, link])),
    [buildingMapLinksQuery.data],
  )
  const scheduleChangeEvents = useMemo(() => {
    const events = scheduleChangesQuery.data ?? []
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('scheduleChangesDemo')) {
      return [
        ...events,
        ...createDemoScheduleChanges(activeScheduleQuery.data, activeScheduleItem, selectedDate),
      ]
    }

    return events
  }, [activeScheduleItem, activeScheduleQuery.data, scheduleChangesQuery.data, selectedDate])
  const today = toIsoDate(now)
  const itemChangeEvents = scheduleChangeEvents.filter(
    (event) => event.item_type === activeScheduleItem?.item_type && event.ruz_id === activeScheduleItem.ruz_id,
  )
  const scheduleDayViews = [previousDate, selectedDate, nextDate].map((date) =>
    buildScheduleDayView({
      date,
      today,
      itemChangeEvents,
      activeScheduleQuery,
      previousWeekQuery,
      nextWeekQuery,
      calendarAnimationWeekQuery,
      selectedWeekStartDate,
      previousWeekStartDate,
      nextWeekStartDate,
      calendarAnimationWeekStartDate,
      hidePastLessons,
      showBreaks,
      scheduleTourActive,
      now,
    }),
  )
  const [previousDayView, selectedDayView, nextDayView] = scheduleDayViews
  const displayedSelectedDayView = scheduleTourActive ? { ...selectedDayView, items: [scheduleTourLessonMock] } : selectedDayView
  const calendarAnimationDayView = calendarAnimation
    ? buildScheduleDayView({
        date: calendarAnimation.date,
        today,
        itemChangeEvents,
        activeScheduleQuery,
        previousWeekQuery,
        nextWeekQuery,
        calendarAnimationWeekQuery,
        selectedWeekStartDate,
        previousWeekStartDate,
        nextWeekStartDate,
        calendarAnimationWeekStartDate,
        hidePastLessons,
        showBreaks,
        scheduleTourActive,
        now,
      })
    : null
  const viewportPreviousDayView = calendarAnimation?.direction === -1 && calendarAnimationDayView ? calendarAnimationDayView : previousDayView
  const viewportNextDayView = calendarAnimation?.direction === 1 && calendarAnimationDayView ? calendarAnimationDayView : nextDayView

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (activeScheduleTitle !== 'Расписание') {
      setLastKnownActiveScheduleTitle(activeScheduleTitle)
    }
  }, [activeScheduleTitle])

  function moveSelectedDate(days: number) {
    vibrateTap()
    setSelectedDate((currentDate) => getScheduleDate(addDays(currentDate, days), days))
  }

  function animateSelectedDate(days: number) {
    const direction = days < 0 ? -1 : 1
    if (scheduleViewportRef.current?.animateToDate(direction)) {
      return
    }

    moveSelectedDate(days)
  }

  function selectCalendarDate(date: string) {
    const nextDate = getScheduleDate(date)
    vibrateTap()

    if (nextDate === selectedDate) {
      return
    }

    const direction = nextDate > selectedDate ? 1 : -1
    flushSync(() => setCalendarAnimation({ date: nextDate, direction }))
    const commit = () => {
      setSelectedDate(nextDate)
      setCalendarAnimation(null)
    }
    if (scheduleViewportRef.current?.animateToDate(direction, commit)) {
      return
    }

    commit()
  }

  if (user.status === 'loading') {
    return (
      <AppScreen>
        <PageSkeleton show />
      </AppScreen>
    )
  }

  if (user.status === 'error') {
    return (
      <AppScreen>
        <CenteredAlert message={user.errorMessage} />
      </AppScreen>
    )
  }

  if (user.status === 'anonymous') {
    return <Navigate to="/hello" replace />
  }

  if (!user.profile.primary_group) {
    return (
      <AppScreen>
        <EmptyState
          icon={SchoolIcon}
          lottieSrc="/animations/group-not-selected.json"
          title="Учебная группа не выбрана"
          description="Добавь свою учебную группу, чтобы смотреть расписание занятий."
          actionLabel="Выбрать группу"
          onAction={() => setPrimaryGroupDrawerOpen(true)}
        />
        <GroupDrawer
          open={primaryGroupDrawerOpen}
          onClose={() => setPrimaryGroupDrawerOpen(false)}
          currentGroup={null}
          onSaved={(group) => setActiveScheduleItem({ item_type: 'group', ruz_id: group.id })}
        />
      </AppScreen>
    )
  }

  return (
    <AppScreen>
      <ScheduleHeader
        selectedDate={selectedDate}
        dateAnchor={dateAnchor}
        onDateAnchorChange={setDateAnchor}
        onSelectedDateChange={selectCalendarDate}
        onMoveSelectedDate={animateSelectedDate}
      />
      <ScheduleHeaderTour
        lessonDetailsOpen={lessonDrawerOpen}
        scheduleDrawerOpen={scheduleDrawerOpen}
        onActiveChange={setScheduleTourActive}
        onLessonDetailsClose={() => setLessonDrawerOpen(false)}
        onScheduleDrawerClose={() => setScheduleDrawerOpen(false)}
      />
      <SwipeableScheduleViewport
        ref={scheduleViewportRef}
        disabled={scheduleTourActive}
        pageKeys={[viewportPreviousDayView.date, displayedSelectedDayView.date, viewportNextDayView.date]}
        previous={renderScheduleDay(viewportPreviousDayView, showBreaks, now, handleLessonClick)}
        current={renderScheduleDay(displayedSelectedDayView, showBreaks, now, handleLessonClick)}
        next={renderScheduleDay(viewportNextDayView, showBreaks, now, handleLessonClick)}
        onDateCommit={moveSelectedDate}
      />
      <ScheduleFavoritesDrawer
        open={scheduleDrawerOpen}
        tourMock={scheduleTourActive && scheduleDrawerOpen}
        activeScheduleItem={activeScheduleItem}
        activeScheduleTitle={activeScheduleTitle === 'Расписание' ? lastKnownActiveScheduleTitle : activeScheduleTitle}
        scheduleItems={scheduleItems}
        scheduleItemQueries={scheduleItemQueries}
        scheduleSearch={scheduleSearch}
        filteredScheduleItems={filteredScheduleItems}
        searchResults={searchResults}
        isExternalSearchPending={isExternalSearchPending}
        isExternalSearchReady={isExternalSearchReady}
        searchError={searchError}
        shouldSearchRuz={shouldSearchRuz}
        addFavoritePending={addFavoriteMutation.isPending}
        addFavoriteError={addFavoriteMutation.isError}
        deleteFavoritePending={deleteFavoriteMutation.isPending}
        deleteFavoriteError={deleteFavoriteMutation.isError}
        onOpen={() => {
          vibrateTap()
          setScheduleDrawerOpen(true)
        }}
        onClose={() => setScheduleDrawerOpen(false)}
        onSearchChange={setScheduleSearch}
        onActiveScheduleItemChange={(item, title) => {
          setLastKnownActiveScheduleTitle(title)
          setActiveScheduleItem(item)
        }}
        onAddFavorite={(result) => addFavoriteMutation.mutate(result)}
        onDeleteFavorite={(item) => deleteFavoriteMutation.mutateAsync(item)}
      />
      <LessonDetailsDrawer
        open={lessonDrawerOpen}
        item={selectedLessonItem}
        mapUrl={selectedLessonItem?.lesson ? getLessonMapUrl(selectedLessonItem.lesson, buildingMapLinksById) : undefined}
        onClose={() => setLessonDrawerOpen(false)}
        onExited={() => setSelectedLessonItem(null)}
      />
    </AppScreen>
  )

  function handleLessonClick(item: ScheduleLessonItem) {
    vibrateTap()
    setSelectedLessonItem(item)
    setLessonDrawerOpen(true)
  }
}

const scheduleTourLessonMock: ScheduleLessonItem = {
  id: 'tour:lesson-card',
  lesson: null,
  summary: {
    subject: 'Проектирование интерфейсов',
    lessonType: 'Практика',
    timeStart: '10:40',
    timeEnd: '12:10',
    teachers: 'Иванова Анна Сергеевна',
    auditories: 'Главный учебный корпус, ауд. 305',
  },
  changes: [{ kind: 'time', before: '09:00' }],
}

function getScheduleDate(date: string, direction = 1): string {
  return isSunday(date) ? addDays(date, direction > 0 ? 1 : -1) : date
}

type ScheduleDayView = {
  date: string
  items: ScheduleLessonItem[]
  loading: boolean
  error: boolean
  success: boolean
  stale: boolean
  emptyStateTitle: string
  emptyStateLottieSrc: string
  onRefresh: () => unknown
}

type BuildScheduleDayViewParams = {
  date: string
  today: string
  itemChangeEvents: Parameters<typeof buildScheduleLessonItems>[2]
  activeScheduleQuery: ScheduleWeekQuery
  previousWeekQuery: ScheduleWeekQuery
  nextWeekQuery: ScheduleWeekQuery
  calendarAnimationWeekQuery?: ScheduleWeekQuery
  selectedWeekStartDate: string
  previousWeekStartDate: string
  nextWeekStartDate: string
  calendarAnimationWeekStartDate?: string
  hidePastLessons: boolean
  showBreaks: boolean
  scheduleTourActive: boolean
  now: Date
}

function buildScheduleDayView({
  date,
  today,
  itemChangeEvents,
  activeScheduleQuery,
  previousWeekQuery,
  nextWeekQuery,
  calendarAnimationWeekQuery,
  selectedWeekStartDate,
  previousWeekStartDate,
  nextWeekStartDate,
  calendarAnimationWeekStartDate,
  hidePastLessons,
  showBreaks,
  scheduleTourActive,
  now,
}: BuildScheduleDayViewParams): ScheduleDayView {
  const weekQuery = getScheduleWeekQuery(
    date,
    selectedWeekStartDate,
    activeScheduleQuery,
    previousWeekStartDate,
    previousWeekQuery,
    nextWeekStartDate,
    nextWeekQuery,
    calendarAnimationWeekStartDate,
    calendarAnimationWeekQuery,
  )
  const day = weekQuery.data?.days.find((scheduleDay) => scheduleDay.date === date)
  const lessons =
    day && hidePastLessons && date === today
      ? day.lessons.filter(
          (lesson, index, dayLessons) =>
            !isLessonPast(lesson.time_end, now) ||
            (showBreaks && index < dayLessons.length - 1 && isBreakActive(lesson, dayLessons[index + 1], now)),
        )
      : (day?.lessons ?? [])
  const allTodayLessonsHidden = hidePastLessons && date === today && Boolean(day?.lessons.length) && lessons.length === 0

  return {
    date,
    items: buildScheduleLessonItems(lessons, date, itemChangeEvents),
    loading: scheduleTourActive ? false : weekQuery.isPending,
    error: scheduleTourActive ? false : weekQuery.isError,
    success: scheduleTourActive ? true : weekQuery.isSuccess,
    stale: scheduleTourActive ? false : isScheduleStale(weekQuery.data),
    emptyStateTitle: allTodayLessonsHidden ? 'Сегодня занятий больше нет' : 'На этот день занятий нет',
    emptyStateLottieSrc: allTodayLessonsHidden ? '/animations/lessons-finished.json' : '/animations/no-lessons.json',
    onRefresh: weekQuery.refetch,
  }
}

function renderScheduleDay(
  dayView: ScheduleDayView,
  showBreaks: boolean,
  now: Date,
  onLessonClick: (item: ScheduleLessonItem) => void,
) {
  return (
    <ScheduleList
      items={dayView.items}
      showBreaks={showBreaks}
      now={now}
      loading={dayView.loading}
      error={dayView.error}
      success={dayView.success}
      stale={dayView.stale}
      emptyStateTitle={dayView.emptyStateTitle}
      emptyStateLottieSrc={dayView.emptyStateLottieSrc}
      onLessonClick={onLessonClick}
      onRefresh={() => {
        void dayView.onRefresh()
      }}
    />
  )
}

function fetchScheduleOrThrow(item: Parameters<typeof fetchSchedule>[0] | null | undefined, weekStartDate: string) {
  if (!item) {
    throw new Error('Schedule item is not selected')
  }

  return fetchSchedule(item, weekStartDate)
}

type ScheduleWeekQuery = Pick<UseQueryResult<Schedule>, 'data' | 'isPending' | 'isError' | 'isSuccess' | 'refetch'>

function getScheduleWeekQuery(
  date: string,
  selectedWeekStartDate: string,
  activeScheduleQuery: ScheduleWeekQuery,
  previousWeekStartDate: string,
  previousWeekQuery: ScheduleWeekQuery,
  nextWeekStartDate: string,
  nextWeekQuery: ScheduleWeekQuery,
  calendarAnimationWeekStartDate?: string,
  calendarAnimationWeekQuery?: ScheduleWeekQuery,
) {
  const weekStartDate = getWeekStartDate(date)
  if (
    calendarAnimationWeekQuery &&
    calendarAnimationWeekStartDate &&
    weekStartDate === calendarAnimationWeekStartDate &&
    weekStartDate !== selectedWeekStartDate
  ) {
    return calendarAnimationWeekQuery
  }
  if (weekStartDate === previousWeekStartDate && previousWeekStartDate !== selectedWeekStartDate) {
    return previousWeekQuery
  }
  if (weekStartDate === nextWeekStartDate && nextWeekStartDate !== selectedWeekStartDate) {
    return nextWeekQuery
  }

  return activeScheduleQuery
}

function isScheduleStale(schedule: Schedule | undefined) {
  return schedule !== undefined && 'meta' in schedule && schedule.meta?.is_stale === true
}
