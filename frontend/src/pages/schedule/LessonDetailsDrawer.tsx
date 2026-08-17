import Button from '@mui/material/Button'
import PersonIcon from '@mui/icons-material/Person'
import PlaceIcon from '@mui/icons-material/Place'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { formatLessonTime } from '../../shared/date'
import { BottomDrawer } from '../../shared/ui/BottomDrawer'
import { formatAuditorium, type Lesson } from './schedule-utils'

type LessonDetailsDrawerProps = {
  open: boolean
  lesson: Lesson | null
  mapUrl: string | undefined
  onClose: () => void
  onExited: () => void
}

export function LessonDetailsDrawer({ open, lesson, mapUrl, onClose, onExited }: LessonDetailsDrawerProps) {
  const lessonType = lesson?.typeObj?.name || lesson?.typeObj?.abbr || 'Занятие'
  const timeStart = formatLessonTime(lesson?.time_start ?? null)
  const timeEnd = formatLessonTime(lesson?.time_end ?? null)
  const teachers = lesson?.teachers?.map((teacher) => teacher.full_name).join(', ')
  const auditories = lesson?.auditories.map(formatAuditorium).join(', ')
  const lmsUrl = normalizeUrl(lesson?.lms_url)
  const webinarUrl = normalizeUrl(lesson?.webinar_url)

  return (
    <BottomDrawer open={open} onClose={onClose} onExited={onExited} maxHeight="80vh">
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
            <Button variant="contained" size="large" disabled={!lmsUrl} onClick={() => openExternalUrl(lmsUrl)} fullWidth>
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
          <Button variant="outlined" size="large" disabled={!mapUrl} onClick={() => openExternalUrl(mapUrl)} fullWidth>
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
