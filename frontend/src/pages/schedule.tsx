import SchoolIcon from '@mui/icons-material/School'
import { useQuery } from '@tanstack/react-query'
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { useUserPreferences } from '../app/user-preferences-context'
import { GroupDrawer } from '../features/profile/GroupDrawer'
import { getBuildingMapLinks } from '../shared/api/buildings'
import { queryKeys } from '../shared/api/queryKeys'
import { getScheduleChanges } from '../shared/api/scheduleChanges'
import { useRequiredUser } from '../shared/api/useRequiredUser'
import { addDays, isSunday, toIsoDate } from '../shared/date'
import { AppScreen } from '../shared/ui/AppScreen'
import { CenteredAlert } from '../shared/ui/CenteredAlert'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageSkeleton } from '../shared/ui/PageSkeleton'
import { LessonDetailsDrawer } from './schedule/LessonDetailsDrawer'
import { ScheduleFavoritesDrawer } from './schedule/ScheduleFavoritesDrawer'
import { ScheduleHeader } from './schedule/ScheduleHeader'
import { ScheduleList } from './schedule/ScheduleList'
import {
  buildScheduleLessonItems,
  createDemoScheduleChanges,
  type ScheduleLessonItem,
} from './schedule/schedule-change-utils'
import { getLessonMapUrl, isBreakActive, isLessonPast } from './schedule/schedule-utils'
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
  const [lastKnownActiveScheduleTitle, setLastKnownActiveScheduleTitle] = useState('Расписание')
  const [now, setNow] = useState(() => new Date())
  const swipeStartX = useRef<number | null>(null)

  const profile = user.status === 'ready' ? user.profile : null
  const {
    scheduleItems,
    activeScheduleItem,
    activeScheduleQuery,
    scheduleItemQueries,
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
  const buildingMapLinksById = useMemo(
    () => new Map((buildingMapLinksQuery.data ?? []).map((link) => [link.building_id, link])),
    [buildingMapLinksQuery.data],
  )
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

    return selectedDay.lessons.filter(
      (lesson, index, lessons) =>
        !isLessonPast(lesson.time_end, now) || (showBreaks && index < lessons.length - 1 && isBreakActive(lesson, lessons[index + 1], now)),
    )
  }, [hidePastLessons, now, selectedDate, selectedDay, showBreaks])
  const allTodayLessonsHidden =
    hidePastLessons &&
    selectedDate === toIsoDate(now) &&
    Boolean(selectedDay?.lessons.length) &&
    visibleLessons.length === 0
  const emptyStateTitle = allTodayLessonsHidden ? 'Сегодня занятий больше нет' : 'На этот день занятий нет'
  const emptyStateLottieSrc = allTodayLessonsHidden ? '/animations/lessons-finished.json' : '/animations/no-lessons.json'
  const scheduleStale =
    activeScheduleQuery.data !== undefined &&
    'meta' in activeScheduleQuery.data &&
    activeScheduleQuery.data.meta?.is_stale === true
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
  const scheduleLessonItems = useMemo(
    () =>
      buildScheduleLessonItems(
        visibleLessons,
        selectedDate,
        scheduleChangeEvents.filter(
          (event) => event.item_type === activeScheduleItem?.item_type && event.ruz_id === activeScheduleItem.ruz_id,
        ),
      ),
    [activeScheduleItem, scheduleChangeEvents, selectedDate, visibleLessons],
  )

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
    setSelectedDate((currentDate) => getScheduleDate(addDays(currentDate, days), days))
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
        onSelectedDateChange={(date) => setSelectedDate(getScheduleDate(date))}
        onMoveSelectedDate={moveSelectedDate}
      />
      <ScheduleList
        items={scheduleLessonItems}
        showBreaks={showBreaks}
        now={now}
        loading={activeScheduleQuery.isPending}
        error={activeScheduleQuery.isError}
        success={activeScheduleQuery.isSuccess}
        stale={scheduleStale}
        emptyStateTitle={emptyStateTitle}
        emptyStateLottieSrc={emptyStateLottieSrc}
        onLessonClick={(item) => {
          setSelectedLessonItem(item)
          setLessonDrawerOpen(true)
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />
      <ScheduleFavoritesDrawer
        open={scheduleDrawerOpen}
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
        onOpen={() => setScheduleDrawerOpen(true)}
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
}

function getScheduleDate(date: string, direction = 1): string {
  return isSunday(date) ? addDays(date, direction > 0 ? 1 : -1) : date
}
