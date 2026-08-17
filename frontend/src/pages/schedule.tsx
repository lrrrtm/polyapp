import SchoolIcon from '@mui/icons-material/School'
import { useQuery } from '@tanstack/react-query'
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { useUserPreferences } from '../app/user-preferences-context'
import { GroupDrawer } from '../features/profile/GroupDrawer'
import { getBuildingMapLinks } from '../shared/api/buildings'
import { queryKeys } from '../shared/api/queryKeys'
import { useRequiredUser } from '../shared/api/useRequiredUser'
import { addDays, toIsoDate } from '../shared/date'
import { AppScreen } from '../shared/ui/AppScreen'
import { CenteredAlert } from '../shared/ui/CenteredAlert'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageSkeleton } from '../shared/ui/PageSkeleton'
import { LessonDetailsDrawer } from './schedule/LessonDetailsDrawer'
import { ScheduleFavoritesDrawer } from './schedule/ScheduleFavoritesDrawer'
import { ScheduleHeader } from './schedule/ScheduleHeader'
import { ScheduleList } from './schedule/ScheduleList'
import { getLessonMapUrl, isLessonPast, type Lesson } from './schedule/schedule-utils'
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
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()))
  const [dateAnchor, setDateAnchor] = useState<HTMLButtonElement | null>(null)
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false)
  const [primaryGroupDrawerOpen, setPrimaryGroupDrawerOpen] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false)
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
  } = useScheduleSearch(scheduleDrawerOpen, scheduleItems, scheduleItemQueries)
  const buildingMapLinksQuery = useQuery({
    queryKey: queryKeys.buildingMapLinks(),
    queryFn: getBuildingMapLinks,
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

    return selectedDay.lessons.filter((lesson) => !isLessonPast(lesson.time_end, now))
  }, [hidePastLessons, now, selectedDate, selectedDay])
  const allTodayLessonsHidden =
    hidePastLessons &&
    selectedDate === toIsoDate(now) &&
    Boolean(selectedDay?.lessons.length) &&
    visibleLessons.length === 0
  const emptyStateTitle = allTodayLessonsHidden ? 'Сегодня занятий больше нет' : 'На этот день занятий нет'

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000)
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

  if (user.status === 'loading') {
    return <PageSkeleton show />
  }

  if (user.status === 'error') {
    return <CenteredAlert message={user.errorMessage} />
  }

  if (user.status === 'anonymous') {
    return <Navigate to="/hello" replace />
  }

  if (!user.profile.primary_group) {
    return (
      <AppScreen>
        <EmptyState
          icon={SchoolIcon}
          title="Учебная группа не выбрана"
          description="Добавь свою учебную группу, чтобы смотреть расписание занятий."
          actionLabel="Выбрать группу"
          onAction={() => setPrimaryGroupDrawerOpen(true)}
        />
        <GroupDrawer
          open={primaryGroupDrawerOpen}
          onClose={() => setPrimaryGroupDrawerOpen(false)}
          currentGroup={null}
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
        onSelectedDateChange={setSelectedDate}
        onMoveSelectedDate={moveSelectedDate}
      />
      <ScheduleList
        visibleLessons={visibleLessons}
        showBreaks={showBreaks}
        now={now}
        loading={activeScheduleQuery.isPending}
        error={activeScheduleQuery.isError}
        success={activeScheduleQuery.isSuccess}
        emptyStateTitle={emptyStateTitle}
        onLessonClick={(lesson) => {
          setSelectedLesson(lesson)
          setLessonDrawerOpen(true)
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />
      <ScheduleFavoritesDrawer
        open={scheduleDrawerOpen}
        activeScheduleItem={activeScheduleItem}
        activeScheduleTitle={activeScheduleTitle}
        activeScheduleLoading={activeScheduleQuery.isPending}
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
        onOpen={() => setScheduleDrawerOpen(true)}
        onClose={() => setScheduleDrawerOpen(false)}
        onSearchChange={setScheduleSearch}
        onActiveScheduleItemChange={setActiveScheduleItem}
        onAddFavorite={(result) => addFavoriteMutation.mutate(result)}
      />
      <LessonDetailsDrawer
        open={lessonDrawerOpen}
        lesson={selectedLesson}
        mapUrl={selectedLesson ? getLessonMapUrl(selectedLesson, buildingMapLinksById) : undefined}
        onClose={() => setLessonDrawerOpen(false)}
        onExited={() => setSelectedLesson(null)}
      />
    </AppScreen>
  )
}
