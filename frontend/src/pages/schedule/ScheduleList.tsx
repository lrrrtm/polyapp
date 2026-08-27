import Alert from '@mui/material/Alert'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import LinearProgress from '@mui/material/LinearProgress'
import PersonIcon from '@mui/icons-material/Person'
import PlaceIcon from '@mui/icons-material/Place'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, keyframes } from '@mui/material/styles'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DelayedSkeleton } from '../../shared/ui/DelayedSkeleton'
import { EmptyState } from '../../shared/ui/EmptyState'
import { useDelayedVisible } from '../../shared/ui/useDelayedVisible'
import type { ScheduleChangeKind, ScheduleLessonItem } from './schedule-change-utils'
import {
  formatBreakCountdown,
  formatBreakDuration,
  getBreakDurationMinutes,
  getBreakRemainingSeconds,
  isBreakActive,
  isLessonActive,
} from './schedule-utils'

const activeLessonPulse = keyframes`
  0%, 100% {
    background-color: var(--active-lesson-bg);
  }
  50% {
    background-color: var(--active-lesson-bg-pulse);
  }
`

type ScheduleListProps = {
  items: ScheduleLessonItem[]
  showBreaks: boolean
  now: Date
  loading: boolean
  error: boolean
  success: boolean
  stale: boolean
  emptyStateTitle: string
  emptyStateLottieSrc?: string
  onLessonClick: (item: ScheduleLessonItem) => void
  onRefresh: () => void
}

export function ScheduleList({
  items,
  showBreaks,
  now,
  loading,
  error,
  success,
  stale,
  emptyStateTitle,
  emptyStateLottieSrc,
  onLessonClick,
  onRefresh,
}: ScheduleListProps) {
  const showSchedule = success && !error
  const hasSelectedDayLessons = showSchedule && items.length > 0

  return (
    <Stack
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: hasSelectedDayLessons ? 'auto' : 'hidden',
        py: 0,
        touchAction: 'pan-y',
      }}
    >
      {loading ? <ScheduleLoading show /> : null}
      {error ? (
        <EmptyState
          lottieSrc="/animations/schedule-error.json"
          title="Что-то сломалось"
          description="Не удалось загрузить расписание"
          actionLabel="Обновить"
          onAction={onRefresh}
          sx={{ flex: 1, minHeight: 0 }}
        />
      ) : null}
      {showSchedule && stale ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Сервис расписания временно недоступен. Показаны последние сохранённые данные.
        </Alert>
      ) : null}
      {showSchedule && items.length === 0 ? (
        <EmptyState icon={EventBusyIcon} lottieSrc={emptyStateLottieSrc} title={emptyStateTitle} sx={{ flex: 1, minHeight: 0 }} />
      ) : null}
      {showSchedule ? items.map((item, index) => {
        const nextItem = items[index + 1]
        const nextLesson = nextItem?.lesson
        const breakMinutes = item.lesson && nextLesson ? getBreakDurationMinutes(item.lesson, nextLesson) : 0
        const breakRemainingSeconds = item.lesson && nextLesson ? getBreakRemainingSeconds(item.lesson, nextLesson, now) : 0
        const activeLesson = item.lesson ? isLessonActive(item.lesson.time_start, item.lesson.time_end, now) : false
        const activeBreak = item.lesson && nextLesson ? isBreakActive(item.lesson, nextLesson, now) : false

        return (
          <Box key={item.id}>
            <ButtonBase
              data-tour={index === 0 ? 'schedule-lesson-card' : undefined}
              onClick={() => onLessonClick(item)}
              sx={{
                display: 'block',
                width: 1,
                borderRadius: 2,
                px: 2,
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
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {item.summary.lessonType}
                    </Typography>
                    <ScheduleChangeChips kinds={item.changes.map((change) => change.kind)} />
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={
                      activeLesson
                        ? (theme) => ({
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            '--active-lesson-bg':
                              theme.palette.mode === 'dark'
                                ? alpha(theme.palette.primary.light, 0.34)
                                : alpha(theme.palette.primary.main, 0.12),
                            '--active-lesson-bg-pulse':
                              theme.palette.mode === 'dark'
                                ? alpha(theme.palette.primary.light, 0.5)
                                : alpha(theme.palette.primary.main, 0.24),
                            animation: `${activeLessonPulse} 1.8s ease-in-out infinite`,
                            color:
                              theme.palette.mode === 'dark'
                                ? theme.palette.primary.contrastText
                                : theme.palette.primary.dark,
                          })
                        : undefined
                    }
                  >
                    {item.summary.timeStart}
                    {item.summary.timeEnd ? ` - ${item.summary.timeEnd}` : ''}
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
                    {item.summary.subject}
                  </Typography>
                  {item.summary.teachers ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <PersonIcon color="action" fontSize="small" />
                      <Typography variant="body2">{item.summary.teachers}</Typography>
                    </Stack>
                  ) : null}
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <PlaceIcon color="action" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      {item.summary.auditories || 'Аудитория не указана'}
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </ButtonBase>
            {index < items.length - 1 ? (
              showBreaks && breakMinutes > 0 ? (
                <BreakRow minutes={breakMinutes} active={activeBreak} remainingSeconds={breakRemainingSeconds} />
              ) : (
                <Divider />
              )
            ) : null}
          </Box>
        )
      }) : null}
    </Stack>
  )
}

export function ScheduleChangeChips({ kinds }: { kinds: ScheduleChangeKind[] }) {
  const uniqueKinds = useMemo(() => [...new Set(kinds)], [kinds])
  const [visibleCount, setVisibleCount] = useState(uniqueKinds.length)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const chipRefs = useRef<Array<HTMLDivElement | null>>([])
  const overflowRefs = useRef<Array<HTMLDivElement | null>>([])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    const rootElement = root

    function updateVisibleCount() {
      const width = rootElement.getBoundingClientRect().width
      const chipWidths = uniqueKinds.map((_, index) => chipRefs.current[index]?.getBoundingClientRect().width ?? 0)
      const gap = 6

      for (let count = uniqueKinds.length; count >= 0; count -= 1) {
        const hiddenCount = uniqueKinds.length - count
        const overflowWidth = hiddenCount > 0 ? (overflowRefs.current[hiddenCount]?.getBoundingClientRect().width ?? 0) : 0
        const visibleWidth = chipWidths.slice(0, count).reduce((sum, itemWidth) => sum + itemWidth, 0)
        const gaps = Math.max(0, count - 1) + (hiddenCount > 0 && count > 0 ? 1 : 0)

        if (visibleWidth + overflowWidth + gaps * gap <= width) {
          setVisibleCount(count)
          return
        }
      }
    }

    updateVisibleCount()
    const observer = new ResizeObserver(updateVisibleCount)
    observer.observe(rootElement)

    return () => observer.disconnect()
  }, [uniqueKinds])

  if (uniqueKinds.length === 0) {
    return null
  }

  const hiddenCount = uniqueKinds.length - visibleCount

  return (
    <Box component="span" ref={rootRef} sx={{ position: 'relative', display: 'inline-flex', gap: 0.75, flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {uniqueKinds.slice(0, visibleCount).map((kind) => {
        const chip = scheduleChangeChipByKind[kind]
        const Icon = chip.icon

        return (
          <Chip
            key={kind}
            icon={<Icon />}
            label={chip.label}
            color={chip.color}
            size="small"
            sx={{ height: 24 }}
          />
        )
      })}
      {hiddenCount > 0 ? <Chip label={`+${hiddenCount}`} size="small" sx={{ height: 24 }} /> : null}
      <Box
        component="span"
        aria-hidden
        sx={{ position: 'absolute', display: 'inline-flex', gap: 0.75, visibility: 'hidden', pointerEvents: 'none' }}
      >
        {uniqueKinds.map((kind, index) => {
          const chip = scheduleChangeChipByKind[kind]
          const Icon = chip.icon

          return (
            <Chip
              key={kind}
              ref={(element) => {
                chipRefs.current[index] = element
              }}
              icon={<Icon />}
              label={chip.label}
              color={chip.color}
              size="small"
              sx={{ height: 24 }}
            />
          )
        })}
        {uniqueKinds.map((_, index) => (
          <Chip
            key={index + 1}
            ref={(element) => {
              overflowRefs.current[index + 1] = element
            }}
            label={`+${index + 1}`}
            size="small"
            sx={{ height: 24 }}
          />
        ))}
      </Box>
    </Box>
  )
}

const scheduleChangeChipByKind = {
  added: { label: 'Добавлена', color: 'success', icon: AddCircleOutlineIcon },
  removed: { label: 'Отменена', color: 'error', icon: CancelOutlinedIcon },
  time: { label: 'Время', color: 'warning', icon: AccessTimeIcon },
  date: { label: 'Дата', color: 'warning', icon: EventRepeatIcon },
  auditorium: { label: 'Аудитория', color: 'info', icon: PlaceIcon },
  teacher: { label: 'Преподаватель', color: 'info', icon: PersonIcon },
} satisfies Record<ScheduleChangeKind, { label: string; color: 'success' | 'error' | 'warning' | 'info'; icon: typeof AddCircleOutlineIcon }>

function ScheduleLoading({ show }: { show: boolean }) {
  const visible = useDelayedVisible(show)

  if (!visible) {
    return null
  }

  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <Box key={index}>
          <Stack spacing={1.5} sx={{ py: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <DelayedSkeleton show={show} delay={0} variant="text" width="22%" />
              <DelayedSkeleton show={show} delay={0} variant="text" width="30%" />
            </Stack>
            <Stack spacing={1}>
              <DelayedSkeleton show={show} delay={0} variant="text" width="82%" height={32} />
              <DelayedSkeleton show={show} delay={0} variant="text" width="62%" />
              <DelayedSkeleton show={show} delay={0} variant="text" width="48%" />
            </Stack>
          </Stack>
          {index < 2 ? <Divider /> : null}
        </Box>
      ))}
    </>
  )
}

type BreakRowProps = {
  minutes: number
  active: boolean
  remainingSeconds?: number
}

function BreakRow({ minutes, active, remainingSeconds = 0 }: BreakRowProps) {
  const label = active ? formatBreakCountdown(remainingSeconds) : formatBreakDuration(minutes)

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1.25 }}>
      {active ? (
        <LinearProgress
          aria-label="Идёт перерыв"
          sx={{ flex: 1, height: 2, borderRadius: 1, transform: 'scaleX(-1)' }}
        />
      ) : (
        <Divider sx={{ flex: 1 }} />
      )}
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        Перерыв {label}
      </Typography>
      {active ? (
        <LinearProgress aria-label="Идёт перерыв" sx={{ flex: 1, height: 2, borderRadius: 1 }} />
      ) : (
        <Divider sx={{ flex: 1 }} />
      )}
    </Stack>
  )
}
