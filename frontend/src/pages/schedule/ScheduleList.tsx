import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import LinearProgress from '@mui/material/LinearProgress'
import PersonIcon from '@mui/icons-material/Person'
import PlaceIcon from '@mui/icons-material/Place'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, keyframes } from '@mui/material/styles'
import type { PointerEvent } from 'react'
import { formatLessonTime } from '../../shared/date'
import { DelayedSkeleton } from '../../shared/ui/DelayedSkeleton'
import { EmptyState } from '../../shared/ui/EmptyState'
import { centeredFixedSurfaceSx } from '../../shared/ui/layout'
import { useDelayedVisible } from '../../shared/ui/useDelayedVisible'
import {
  formatAuditorium,
  formatBreakCountdown,
  formatBreakDuration,
  getBreakDurationMinutes,
  getBreakRemainingSeconds,
  isBreakActive,
  isLessonActive,
  type Lesson,
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
  visibleLessons: Lesson[]
  showBreaks: boolean
  now: Date
  loading: boolean
  error: boolean
  success: boolean
  stale: boolean
  emptyStateTitle: string
  emptyStateLottieSrc?: string
  onLessonClick: (lesson: Lesson) => void
  onPointerDown: (event: PointerEvent<HTMLElement>) => void
  onPointerUp: (event: PointerEvent<HTMLElement>) => void
}

export function ScheduleList({
  visibleLessons,
  showBreaks,
  now,
  loading,
  error,
  success,
  stale,
  emptyStateTitle,
  emptyStateLottieSrc,
  onLessonClick,
  onPointerDown,
  onPointerUp,
}: ScheduleListProps) {
  const hasSelectedDayLessons = visibleLessons.length > 0

  return (
    <Container
      component="main"
      maxWidth={false}
      sx={{
        ...centeredFixedSurfaceSx,
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
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <Stack sx={{ flex: 1, touchAction: 'pan-y' }}>
        {loading ? <ScheduleLoading show /> : null}
        {error ? <Alert severity="error">Не удалось загрузить расписание.</Alert> : null}
        {success && stale ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Сервис расписания временно недоступен. Показаны последние сохранённые данные.
          </Alert>
        ) : null}
        {success && visibleLessons.length === 0 ? (
          <EmptyState icon={EventBusyIcon} lottieSrc={emptyStateLottieSrc} title={emptyStateTitle} sx={{ flex: 1, minHeight: 0 }} />
        ) : null}
        {visibleLessons.map((lesson, index) => {
          const nextLesson = visibleLessons[index + 1]
          const breakMinutes = nextLesson ? getBreakDurationMinutes(lesson, nextLesson) : 0
          const breakRemainingSeconds = nextLesson ? getBreakRemainingSeconds(lesson, nextLesson, now) : 0
          const auditories = lesson.auditories.map(formatAuditorium).join(', ')
          const teachers = lesson.teachers?.map((teacher) => teacher.full_name).join(', ')
          const lessonType = lesson.typeObj?.name || lesson.typeObj?.abbr || 'Занятие'
          const timeStart = formatLessonTime(lesson.time_start)
          const timeEnd = formatLessonTime(lesson.time_end)
          const activeLesson = isLessonActive(lesson.time_start, lesson.time_end, now)
          const activeBreak = nextLesson ? isBreakActive(lesson, nextLesson, now) : false

          return (
            <Box key={`${lesson.subject}-${lesson.time_start}-${index}`}>
              <ButtonBase
                onClick={() => onLessonClick(lesson)}
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
                  <BreakRow minutes={breakMinutes} active={activeBreak} remainingSeconds={breakRemainingSeconds} />
                ) : (
                  <Divider />
                )
              ) : null}
            </Box>
          )
        })}
      </Stack>
    </Container>
  )
}

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
