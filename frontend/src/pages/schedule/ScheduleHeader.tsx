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
import { useMemo } from 'react'
import { formatScheduleHeaderDate } from '../../shared/date'
import { centeredFixedSurfaceSx } from '../../shared/ui/layout'

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

  return (
    <>
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
            onClick={() => onMoveSelectedDate(-1)}
            sx={{ justifySelf: 'start' }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Button
            color="inherit"
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
        onClose={() => onDateAnchorChange(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <DateCalendar
          value={calendarValue}
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
