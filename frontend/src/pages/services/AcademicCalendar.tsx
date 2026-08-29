import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { alpha, type Theme } from '@mui/material/styles'
import { useEffect, useState } from 'react'
import type { CurrentAcademicCalendar } from '../../shared/api/services'
import { BottomDrawer, BottomDrawerContent } from '../../shared/ui/BottomDrawer'

const academicPeriodLabels: Record<string, string> = {
  theory: 'Учёба',
  exam: 'Экзамены',
  practice: 'Производственная практика',
  diploma: 'Диплом',
  vacation: 'Каникулы',
  pre_diploma_practice: 'Преддипломная практика',
  holiday: 'Праздники',
}
const academicWeekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const academicCalendarGridMaxWidth = 316
const academicPeriodPriority: Record<string, number> = {
  holiday: 60,
  exam: 50,
  diploma: 45,
  pre_diploma_practice: 40,
  practice: 35,
  vacation: 30,
  theory: 20,
}

type AcademicPeriodRange = CurrentAcademicCalendar['periods'][number]
type SelectedAcademicCalendarDay = {
  date: Date
  periodType: string
}

export function AcademicCalendarCard({ onOpen }: { onOpen: () => void }) {
  return (
    <Card
      elevation={0}
      sx={{
        width: 1,
        borderRadius: 1,
        bgcolor: 'action.hover',
        border: 1,
        borderColor: 'transparent',
      }}
    >
      <CardActionArea
        onClick={onOpen}
        sx={{
          textAlign: 'left',
          '&.Mui-focusVisible': {
            boxShadow: (theme: Theme) => `inset 0 0 0 2px ${alpha(theme.palette.primary.main, 0.72)}`,
          },
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
              <ServiceCardIcon />
              <Typography variant="subtitle1" component="h1" noWrap sx={{ minWidth: 0 }}>
                Календарь учёбы
              </Typography>
            </Stack>
            <ChevronRightIcon color="action" sx={{ flexShrink: 0 }} />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export function AcademicCalendarDrawer({
  open,
  calendar,
  loading,
  error,
  onClose,
}: {
  open: boolean
  calendar?: CurrentAcademicCalendar
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedDay, setSelectedDay] = useState<SelectedAcademicCalendarDay | null>(null)
  const [selectedDayDrawerOpen, setSelectedDayDrawerOpen] = useState(false)
  const academicYears = calendar ? getAcademicYearTabs(calendar.periods) : []
  const selectedYear = academicYears.find((year) => year.key === selectedAcademicYear) ?? academicYears[0]

  useEffect(() => {
    if (!open || !calendar) {
      return
    }

    const years = getAcademicYearTabs(calendar.periods)
    if (years.some((year) => year.key === selectedAcademicYear)) {
      return
    }

    setSelectedAcademicYear(getCurrentAcademicYearKey(new Date(), years) ?? years[0]?.key ?? '')
  }, [calendar, open, selectedAcademicYear])

  return (
    <>
      <BottomDrawer
        open={open}
        onClose={onClose}
        onAfterClose={() => {
          setSelectedDay(null)
          setSelectedDayDrawerOpen(false)
        }}
        title="Календарь учёбы"
        maxHeight="78dvh"
        contentSx={{ display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}
      >
        {loading || error ? (
          <BottomDrawerContent spacing={2} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {loading ? <AcademicCalendarSkeleton /> : null}
            {error ? <Alert severity="info">{error}</Alert> : null}
          </BottomDrawerContent>
        ) : null}
        {!loading && !error && calendar ? (
          <Stack sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Box sx={{ px: 3, flexShrink: 0 }}>
              <Tabs
                value={selectedYear?.key ?? false}
                onChange={(_, value: string) => setSelectedAcademicYear(value)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                aria-label="Учебный год"
              >
                {academicYears.map((year) => (
                  <Tab key={year.key} value={year.key} label={year.label} />
                ))}
              </Tabs>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <Stack spacing={3} sx={{ px: 3, pt: 2, pb: 4 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: `minmax(0, ${academicCalendarGridMaxWidth}px)`,
                      md: `repeat(2, minmax(0, ${academicCalendarGridMaxWidth}px))`,
                      lg: `repeat(3, minmax(0, ${academicCalendarGridMaxWidth}px))`,
                    },
                    gap: 3,
                    alignItems: 'start',
                    justifyContent: 'center',
                  }}
                >
                  {selectedYear?.months.map((month) => (
                    <AcademicMonthCalendar
                      key={`${month.getFullYear()}-${month.getMonth()}`}
                      month={month}
                      periods={selectedYear.periods}
                      onDaySelect={(day) => {
                        setSelectedDay(day)
                        setSelectedDayDrawerOpen(true)
                      }}
                    />
                  ))}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ width: 1, textAlign: 'center' }}>
                  Данные взяты из{' '}
                  <Link href={calendar.source_url} target="_blank" rel="noreferrer" underline="hover">
                    календарного учебного графика
                  </Link>{' '}
                  учебной программы {calendar.direction_code}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        ) : null}
      </BottomDrawer>
      <BottomDrawer
        open={open && selectedDayDrawerOpen}
        onClose={() => setSelectedDayDrawerOpen(false)}
        onAfterClose={() => setSelectedDay(null)}
        maxHeight="32dvh"
      >
        {selectedDay ? (
          <BottomDrawerContent spacing={0.75}>
            <Typography variant="h6" component="h3">
              {formatDate(selectedDay.date)}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {getPeriodLabel(selectedDay.periodType)}
            </Typography>
          </BottomDrawerContent>
        ) : null}
      </BottomDrawer>
    </>
  )
}

function AcademicMonthCalendar({
  month,
  periods,
  onDaySelect,
}: {
  month: Date
  periods: AcademicPeriodRange[]
  onDaySelect: (day: SelectedAcademicCalendarDay) => void
}) {
  const monthDays = getMonthCalendarDays(month)

  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle1" component="h3">
        {formatMonthName(month)}
      </Typography>
      <Box
        sx={{
          width: 1,
          maxWidth: academicCalendarGridMaxWidth,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 40px))',
          gap: 0.75,
        }}
      >
        {academicWeekdayLabels.map((label) => (
          <Typography
            key={label}
            variant="caption"
            color="text.secondary"
            sx={{ textAlign: 'center', userSelect: 'none' }}
          >
            {label}
          </Typography>
        ))}
        {monthDays.map((day, index) =>
          day ? (
            <AcademicCalendarDayCell
              key={day.toISOString()}
              day={day}
              periodType={getDayPeriodType(day, periods)}
              onSelect={onDaySelect}
            />
          ) : (
            <Box key={`empty-${index}`} sx={{ aspectRatio: '1 / 1', minWidth: 0 }} />
          ),
        )}
      </Box>
    </Stack>
  )
}

function AcademicCalendarDayCell({
  day,
  periodType,
  onSelect,
}: {
  day: Date
  periodType: string | null
  onSelect: (day: SelectedAcademicCalendarDay) => void
}) {
  const isSunday = day.getDay() === 0
  const visiblePeriodType = isSunday ? null : periodType
  const cellSx = (theme: Theme) => ({
    aspectRatio: '1 / 1',
    minWidth: 0,
    borderRadius: 1,
    bgcolor: visiblePeriodType
      ? alpha(getAcademicPeriodColor(theme, visiblePeriodType), theme.palette.mode === 'dark' ? 0.34 : 0.2)
      : 'action.hover',
    color: visiblePeriodType ? 'text.primary' : 'text.disabled',
    border: 1,
    borderColor: visiblePeriodType ? alpha(getAcademicPeriodColor(theme, visiblePeriodType), 0.38) : 'transparent',
    display: 'grid',
    placeItems: 'center',
    typography: 'caption',
    userSelect: 'none',
    '&.Mui-focusVisible': {
      boxShadow: `inset 0 0 0 2px ${alpha(theme.palette.primary.main, 0.72)}`,
    },
  })

  if (!visiblePeriodType) {
    return (
      <Box component="span" sx={cellSx}>
        {day.getDate()}
      </Box>
    )
  }

  return (
    <ButtonBase component="span" onClick={() => onSelect({ date: day, periodType: visiblePeriodType })} sx={cellSx}>
      {day.getDate()}
    </ButtonBase>
  )
}

function AcademicCalendarSkeleton() {
  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Skeleton width="56%" />
        <Skeleton width="72%" height={30} />
        <Skeleton width="42%" />
        <Skeleton variant="rounded" height={6} />
      </Stack>
      {[0, 1, 2, 3].map((item) => (
        <Skeleton key={item} variant="rounded" height={54} />
      ))}
    </Stack>
  )
}

function ServiceCardIcon() {
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        color: 'text.secondary',
        display: 'grid',
        flexShrink: 0,
        placeItems: 'center',
      }}
    >
      <CalendarMonthOutlinedIcon fontSize="small" aria-hidden />
    </Box>
  )
}

function getPeriodLabel(periodType: string) {
  return academicPeriodLabels[periodType] ?? periodType
}

function getAcademicPeriodColor(theme: Theme, periodType: string) {
  switch (periodType) {
    case 'exam':
      return theme.palette.warning.main
    case 'practice':
      return theme.palette.info.main
    case 'pre_diploma_practice':
      return theme.palette.secondary.main
    case 'diploma':
      return theme.palette.text.secondary
    case 'vacation':
      return theme.palette.grey[500]
    case 'holiday':
      return theme.palette.error.main
    case 'theory':
    default:
      return theme.palette.primary.main
  }
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getAcademicYearTabs(periods: CurrentAcademicCalendar['periods']) {
  const years = new Map<string, AcademicPeriodRange[]>()
  for (const period of periods) {
    const key = getAcademicYearKey(parseLocalDate(period.start_date))
    years.set(key, [...(years.get(key) ?? []), period])
  }

  return Array.from(years.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, yearPeriods]) => ({
      key,
      label: key,
      periods: yearPeriods,
      months: getAcademicYearMonths(key),
    }))
}

function getCurrentAcademicYearKey(date: Date, years: Array<{ key: string }>) {
  const key = getAcademicYearKey(date)
  return years.some((year) => year.key === key) ? key : null
}

function getAcademicYearKey(date: Date) {
  const startYear = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
  return `${startYear}-${startYear + 1}`
}

function getAcademicYearMonths(key: string) {
  const startYear = Number(key.slice(0, 4))
  return Array.from({ length: 12 }, (_, index) => new Date(index < 4 ? startYear : startYear + 1, (index + 8) % 12, 1))
}

function getMonthCalendarDays(month: Date) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const mondayFirstOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  return [
    ...Array.from<null>({ length: mondayFirstOffset }).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, monthIndex, index + 1)),
  ]
}

function getDayPeriodType(day: Date, periods: AcademicPeriodRange[]) {
  const dayTime = day.getTime()
  const period = periods
    .filter((item) => {
      return dayTime >= parseLocalDate(item.start_date).getTime() && dayTime <= parseLocalDate(item.end_date).getTime()
    })
    .sort((first, second) => getAcademicPeriodPriority(second.period_type) - getAcademicPeriodPriority(first.period_type))[0]
  return period?.period_type ?? null
}

function getAcademicPeriodPriority(periodType: string) {
  return academicPeriodPriority[periodType] ?? 0
}

function formatMonthName(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
  }).format(value)
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value)
}
