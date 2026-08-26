import AppBar from '@mui/material/AppBar'
import Button from '@mui/material/Button'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import dayjs from 'dayjs'
import { useCallback, useMemo } from 'react'
import { formatScheduleHeaderDate } from '../../shared/date'
import { scheduleHeaderControlsMaxWidth } from '../../shared/ui/layout'
import { useBackOverlay } from '../../shared/ui/useBackOverlay'

type ScheduleHeaderProps = {
  selectedDate: string
  dateAnchor: HTMLButtonElement | null
  onDateAnchorChange: (anchor: HTMLButtonElement | null) => void
  onSelectedDateChange: (date: string) => void
  onMoveSelectedDate: (days: number) => void
}

export function ScheduleHeader({
  selectedDate,
  dateAnchor,
  onDateAnchorChange,
  onSelectedDateChange,
  onMoveSelectedDate,
}: ScheduleHeaderProps) {
  const calendarValue = useMemo(() => dayjs(selectedDate), [selectedDate])
  const closeDatePopover = useCallback(() => onDateAnchorChange(null), [onDateAnchorChange])
  const handleDatePopoverClose = useBackOverlay(dateAnchor !== null, closeDatePopover)

  return (
    <>
      <AppBar
        position="absolute"
        color="default"
        elevation={0}
        sx={{ left: 0, right: 0, width: '100%', borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar
          sx={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 40px',
            columnGap: 1,
            minHeight: 56,
            width: 1,
            maxWidth: scheduleHeaderControlsMaxWidth,
            mx: 'auto',
          }}
        >
          <IconButton
            color="inherit"
            aria-label="Предыдущий день"
            data-tour="schedule-prev-day"
            onClick={() => onMoveSelectedDate(-1)}
            sx={{ justifySelf: 'start' }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Button
            color="inherit"
            data-tour="schedule-date"
            onClick={(event) => onDateAnchorChange(event.currentTarget)}
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
            data-tour="schedule-next-day"
            onClick={() => onMoveSelectedDate(1)}
            sx={{ justifySelf: 'end' }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Popover
        open={dateAnchor !== null}
        anchorEl={dateAnchor}
        onClose={handleDatePopoverClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <DateCalendar
          value={calendarValue}
          shouldDisableDate={(value) => value.day() === 0}
          onChange={(value) => {
            if (value?.isValid()) {
              onSelectedDateChange(value.format('YYYY-MM-DD'))
              onDateAnchorChange(null)
            }
          }}
        />
      </Popover>
    </>
  )
}
