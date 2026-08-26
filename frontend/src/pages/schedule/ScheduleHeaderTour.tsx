import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { ACTIONS, EVENTS, Joyride, STATUS, type EventData, type Step, type TooltipRenderProps } from 'react-joyride'
import { type MouseEventHandler, useEffect, useState } from 'react'
import { alpha, keyframes, useTheme } from '@mui/material/styles'

const scheduleHeaderTourStorageKey = 'polytech_schedule_header_tour_seen'
const lessonCardStepIndex = 3
const lessonAlertStepIndex = 4
const lessonActionsStepIndex = 5
const schedulePickerStepIndex = 6
const scheduleFavoritesStepIndex = 7
const tapPulse = keyframes`
  0% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(0.45);
  }
  70% {
    opacity: 0.35;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.25);
  }
`

const steps: Step[] = [
  {
    target: '[data-tour="schedule-prev-day"]',
    title: 'Предыдущий день',
    content: 'Листай расписание назад по одному учебному дню',
    placement: 'bottom-start',
  },
  {
    target: '[data-tour="schedule-date"]',
    title: 'Дата расписания',
    content: 'Нажми на дату, чтобы открыть календарь и быстро перейти к нужному дню',
    placement: 'bottom',
  },
  {
    target: '[data-tour="schedule-next-day"]',
    title: 'Следующий день',
    content: 'А здесь можно перейти к следующему учебному дню',
    placement: 'bottom-end',
  },
  {
    target: '[data-tour="schedule-lesson-card"]',
    title: 'Карточки занятий',
    content: 'В карточке видны тип занятия, время, название, преподаватель и аудитория. Нажми на карточку, чтобы открыть детали',
    placement: 'top',
    data: { hidePrimary: true },
  },
  {
    target: '[data-tour="lesson-changes"]',
    title: 'Изменения в расписании',
    content: 'Если занятие добавили, отменили или изменили, здесь появится короткое уведомление',
    placement: 'top',
  },
  {
    target: '[data-tour="lesson-actions"]',
    title: 'Действия по занятию',
    content: 'Из деталей можно открыть СДО, вебинар или маршрут до корпуса',
    placement: 'top',
  },
  {
    target: '[data-tour="schedule-picker"]',
    title: 'Выбор расписания',
    content: 'Нажми на эту панель, чтобы открыть список избранных расписаний',
    placement: 'top',
    data: { hidePrimary: true },
  },
  {
    target: '[data-tour="schedule-favorites-content"]',
    title: 'Избранные расписания',
    content: 'Здесь можно быстро переключаться между своей группой, другими группами и преподавателями. Через поиск добавляй новые расписания в избранное',
    placement: 'top',
  },
]

type ScheduleHeaderTourProps = {
  lessonDetailsOpen: boolean
  scheduleDrawerOpen: boolean
  onActiveChange: (active: boolean) => void
  onLessonDetailsClose: () => void
  onScheduleDrawerClose: () => void
}

export function ScheduleHeaderTour({
  lessonDetailsOpen,
  scheduleDrawerOpen,
  onActiveChange,
  onLessonDetailsClose,
  onScheduleDrawerClose,
}: ScheduleHeaderTourProps) {
  const theme = useTheme()
  const [run, setRun] = useState(() => localStorage.getItem(scheduleHeaderTourStorageKey) !== 'true')
  const [stepIndex, setStepIndex] = useState(0)
  const waitingTarget = getWaitingTarget(run, steps[stepIndex])

  useEffect(() => {
    onActiveChange(run)
  }, [onActiveChange, run])

  useEffect(() => {
    if (run && lessonDetailsOpen && stepIndex === lessonCardStepIndex) {
      const timeoutId = window.setTimeout(() => setStepIndex(lessonAlertStepIndex), 320)
      return () => window.clearTimeout(timeoutId)
    }
  }, [lessonDetailsOpen, run, stepIndex])

  useEffect(() => {
    if (run && scheduleDrawerOpen && stepIndex === schedulePickerStepIndex) {
      const timeoutId = window.setTimeout(() => setStepIndex(scheduleFavoritesStepIndex), 320)
      return () => window.clearTimeout(timeoutId)
    }
  }, [run, scheduleDrawerOpen, stepIndex])

  function finishTour() {
    localStorage.setItem(scheduleHeaderTourStorageKey, 'true')
    onActiveChange(false)
    onLessonDetailsClose()
    onScheduleDrawerClose()
    setRun(false)
  }

  function handleEvent(data: EventData) {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      finishTour()
      return
    }

    if (data.type !== EVENTS.STEP_AFTER && data.type !== EVENTS.TARGET_NOT_FOUND) {
      return
    }

    if (data.index === lessonAlertStepIndex && data.action === ACTIONS.PREV) {
      onLessonDetailsClose()
    }
    if (data.index === lessonActionsStepIndex && data.action === ACTIONS.NEXT) {
      onLessonDetailsClose()
    }
    if (data.index === scheduleFavoritesStepIndex && data.action === ACTIONS.PREV) {
      onScheduleDrawerClose()
    }

    const nextStepIndex = data.index + (data.action === ACTIONS.PREV ? -1 : 1)
    if (nextStepIndex >= steps.length) {
      finishTour()
      return
    }

    const safeNextStepIndex = Math.max(0, Math.min(nextStepIndex, steps.length - 1))
    if (safeNextStepIndex === lessonActionsStepIndex) {
      window.setTimeout(() => setStepIndex(safeNextStepIndex), 120)
      return
    }

    setStepIndex(safeNextStepIndex)
  }

  return (
    <>
      <Joyride
        continuous
        run={run}
        scrollToFirstStep
        stepIndex={stepIndex}
        steps={steps}
        onEvent={handleEvent}
        tooltipComponent={ScheduleTourTooltip}
        options={{
          buttons: ['skip', 'primary'],
          arrowColor: theme.palette.background.paper,
          backgroundColor: theme.palette.background.paper,
          closeButtonAction: 'skip',
          disableFocusTrap: true,
          overlayClickAction: false,
          primaryColor: theme.palette.primary.main,
          skipBeacon: true,
          targetWaitTimeout: 1500,
          textColor: theme.palette.text.primary,
          zIndex: theme.zIndex.modal + 1,
        }}
        locale={{
          close: 'Закрыть',
          last: 'Готово',
          next: 'Далее',
          skip: 'Пропустить',
        }}
      />
      <TapPulse target={waitingTarget} zIndex={theme.zIndex.modal + 2} />
    </>
  )
}

function ScheduleTourTooltip({
  isLastStep,
  primaryProps,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  const hidePrimary = step.data?.hidePrimary === true

  return (
    <Paper
      elevation={8}
      {...tooltipProps}
      sx={{
        maxWidth: 360,
        p: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          {step.title ? (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {step.title}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {step.content}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', width: 1 }}>
          <Button size="small" color="inherit" {...blurOnClick(skipProps)}>
            Закончить
          </Button>
          <Stack direction="row" spacing={1}>
            {hidePrimary ? null : (
              isLastStep ? (
                <Button size="small" variant="contained" {...blurOnClick(primaryProps)}>
                  Готово
                </Button>
              ) : (
                <IconButton size="small" color="primary" {...blurOnClick(primaryProps)} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}>
                  <ArrowForwardIcon fontSize="small" />
                </IconButton>
              )
            )}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  )
}

type TargetRect = {
  height: number
  left: number
  top: number
  width: number
}

function TapPulse({ target, zIndex }: { target: string | null; zIndex: number }) {
  const [rect, setRect] = useState<TargetRect | null>(null)

  useEffect(() => {
    if (!target) {
      setRect(null)
      return
    }

    const selector = target

    function updateRect() {
      const element = document.querySelector(selector)
      setRect(element ? element.getBoundingClientRect() : null)
    }

    updateRect()
    const intervalId = window.setInterval(updateRect, 250)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [target])

  if (!rect) {
    return null
  }

  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
        width: 64,
        height: 64,
        borderRadius: '50%',
        border: '2px solid',
        borderColor: alpha('#fff', 0.72),
        boxShadow: `0 0 0 1px ${alpha('#000', 0.24)}`,
        pointerEvents: 'none',
        zIndex,
        animation: `${tapPulse} 1.35s ease-out infinite`,
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: '50%',
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: alpha('#fff', 0.82),
          boxShadow: `0 0 0 1px ${alpha('#000', 0.24)}`,
          transform: 'translate(-50%, -50%)',
        },
      }}
    />
  )
}

function getWaitingTarget(run: boolean, step: Step | undefined): string | null {
  return run && step?.data?.hidePrimary === true && typeof step.target === 'string' ? step.target : null
}

function blurOnClick<T extends { onClick: MouseEventHandler<HTMLElement> }>(props: T): T {
  return {
    ...props,
    onClick: (event) => {
      event.currentTarget.blur()
      props.onClick(event)
    },
  }
}
