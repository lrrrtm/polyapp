import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import PersonIcon from '@mui/icons-material/Person'
import PlaceIcon from '@mui/icons-material/Place'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { BottomDrawer, BottomDrawerContent } from '../../shared/ui/BottomDrawer'
import type { LessonChangeDetail, ScheduleLessonItem } from './schedule-change-utils'

type LessonDetailsDrawerProps = {
  open: boolean
  item: ScheduleLessonItem | null
  mapUrl: string | undefined
  onClose: () => void
  onExited: () => void
}

export function LessonDetailsDrawer({ open, item, mapUrl, onClose, onExited }: LessonDetailsDrawerProps) {
  const lmsUrl = normalizeUrl(item?.lesson?.lms_url)
  const webinarUrl = normalizeUrl(item?.lesson?.webinar_url)
  const timeChange = findChange(item?.changes, 'time')
  const auditoriumChange = findChange(item?.changes, 'auditorium')
  const teacherChange = findChange(item?.changes, 'teacher')
  const timeText = [item?.summary.timeStart, item?.summary.timeEnd].filter(Boolean).join(' - ')

  return (
    <BottomDrawer open={open} onClose={onClose} onExited={onExited} maxHeight="80vh">
      <BottomDrawerContent spacing={2.5}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {item?.summary.lessonType}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {timeChange ? <ChangedValue before={timeChange.before} after={timeText} /> : timeText}
          </Typography>
        </Stack>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
          {item?.summary.subject}
        </Typography>
        {item?.changes.length ? <LessonChanges changes={item.changes} /> : null}
        <Stack spacing={1.25}>
          {item?.summary.teachers ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <PersonIcon color="action" fontSize="small" sx={{ mt: 0.125 }} />
              <Typography variant="body2" sx={{ minWidth: 0 }}>
                {teacherChange ? <ChangedValue before={teacherChange.before} after={item.summary.teachers} /> : item.summary.teachers}
              </Typography>
            </Stack>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <PlaceIcon color="action" fontSize="small" sx={{ mt: 0.125 }} />
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
              {auditoriumChange ? (
                <ChangedValue before={auditoriumChange.before} after={item?.summary.auditories || 'Аудитория не указана'} />
              ) : (
                item?.summary.auditories || 'Аудитория не указана'
              )}
            </Typography>
          </Stack>
        </Stack>
        <Stack spacing={1.25} data-tour="lesson-actions">
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
      </BottomDrawerContent>
    </BottomDrawer>
  )
}

function LessonChanges({ changes }: { changes: LessonChangeDetail[] }) {
  const parameterChanges = changes.filter((change) => change.kind !== 'added' && change.kind !== 'removed')

  if (changes.some((change) => change.kind === 'removed')) {
    return (
      <Alert severity="info" variant="filled" data-tour="lesson-changes">
        Занятие отменено
      </Alert>
    )
  }

  if (changes.some((change) => change.kind === 'added')) {
    return (
      <Alert severity="info" variant="filled" data-tour="lesson-changes">
        Занятие добавлено в расписание
      </Alert>
    )
  }

  return (
    <Alert severity="info" variant="filled" data-tour="lesson-changes">
      <Stack spacing={0.5}>
        {parameterChanges.map((change) => (
          <Typography key={`${change.kind}:${change.before}:${change.after}`} variant="body2">
            {lessonChangeMessageByKind[change.kind]}
          </Typography>
        ))}
      </Stack>
    </Alert>
  )
}

function ChangedValue({ before, after }: { before: string | undefined; after: string }) {
  return (
    <Stack component="span" spacing={0.25} sx={{ minWidth: 0 }}>
      {before ? (
        <Typography component="span" variant="inherit" color="text.disabled" sx={{ textDecoration: 'line-through' }}>
          {before}
        </Typography>
      ) : null}
      <Typography component="span" variant="inherit" color="text.primary">
        {after}
      </Typography>
    </Stack>
  )
}

function findChange(changes: LessonChangeDetail[] | undefined, kind: LessonChangeDetail['kind']) {
  return changes?.find((change) => change.kind === kind)
}

const lessonChangeMessageByKind = {
  added: 'Занятие добавлено в расписание',
  removed: 'Занятие отменено',
  time: 'Время проведения изменено',
  date: 'Дата проведения изменена',
  auditorium: 'Аудитория изменена',
  teacher: 'Преподаватель изменён',
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
