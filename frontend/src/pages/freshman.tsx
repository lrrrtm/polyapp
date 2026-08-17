import Alert from '@mui/material/Alert'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate } from 'react-router'
import { ApplicantCodeDrawer } from '../features/profile/ApplicantCodeDrawer'
import { getMyAdmissions, type ApplicantAdmissions } from '../shared/api/admissions'
import { queryKeys } from '../shared/api/queryKeys'
import { useRequiredUser } from '../shared/api/useRequiredUser'
import { AppScreen } from '../shared/ui/AppScreen'
import { CenteredAlert } from '../shared/ui/CenteredAlert'
import { DelayedSkeleton } from '../shared/ui/DelayedSkeleton'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageSkeleton } from '../shared/ui/PageSkeleton'

export function FreshmanPage() {
  const [applicantDrawerOpen, setApplicantDrawerOpen] = useState(false)
  const user = useRequiredUser()
  const admissionsQuery = useQuery({
    queryKey: queryKeys.admissions(),
    queryFn: getMyAdmissions,
    enabled: user.status === 'ready' && user.profile.applicant_code !== null,
    retry: false,
  })

  if (user.status === 'loading') {
    return <PageSkeleton show />
  }

  if (user.status === 'error') {
    return <CenteredAlert message={user.errorMessage} />
  }

  if (user.status === 'anonymous') {
    return <Navigate to="/hello" replace />
  }

  return (
    <AppScreen>
      <Container
        component="main"
        maxWidth="sm"
        sx={{ height: '100%', overflowY: admissionsQuery.isSuccess ? 'auto' : 'hidden', pt: 3, pb: 10 }}
      >
        <Stack spacing={2}>
          {user.profile.applicant_code === null ? (
            <EmptyState
              icon={AssignmentIndIcon}
              title="Код поступающего не указан"
              description="Добавь уникальный код поступающего, чтобы увидеть своё положение в конкурсных списках"
              actionLabel="Указать код"
              onAction={() => setApplicantDrawerOpen(true)}
              sx={{ minHeight: 'calc(100svh - 128px)' }}
            />
          ) : null}
          {user.profile.applicant_code !== null && admissionsQuery.isPending ? <AdmissionsSkeleton show /> : null}
          {user.profile.applicant_code !== null && admissionsQuery.isError ? (
            <Alert severity="info">Данные конкурсных списков пока недоступны.</Alert>
          ) : null}
          {admissionsQuery.isSuccess ? <AdmissionsContent admissions={admissionsQuery.data} /> : null}
        </Stack>
      </Container>
      <ApplicantCodeDrawer
        open={applicantDrawerOpen}
        onClose={() => setApplicantDrawerOpen(false)}
        currentCode={user.profile.applicant_code?.code}
      />
    </AppScreen>
  )
}

function AdmissionsSkeleton({ show }: { show: boolean }) {
  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <DelayedSkeleton show={show} variant="text" width={72} />
              <DelayedSkeleton show={show} variant="text" width={104} />
            </Stack>
            <Stack spacing={0.5} sx={{ alignItems: 'flex-end', flex: 1 }}>
              <DelayedSkeleton show={show} variant="text" width={64} />
              <DelayedSkeleton show={show} variant="rounded" width={84} height={24} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index} variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack spacing={1}>
                <DelayedSkeleton show={show} variant="text" width="86%" height={28} />
                <Stack direction="row" spacing={1}>
                  <DelayedSkeleton show={show} variant="rounded" width={92} height={24} />
                  <DelayedSkeleton show={show} variant="rounded" width={120} height={24} />
                </Stack>
              </Stack>
              <Divider />
              <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                <MetricSkeleton show={show} />
                <MetricSkeleton show={show} />
                <MetricSkeleton show={show} />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}

function MetricSkeleton({ show }: { show: boolean }) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <DelayedSkeleton show={show} variant="text" width={48} height={32} />
      <DelayedSkeleton show={show} variant="text" width={64} />
    </Stack>
  )
}

function AdmissionsContent({ admissions }: { admissions: ApplicantAdmissions }) {
  const matches = [...admissions.matches].sort((first, second) => {
    const firstPriority = first.priority ?? Number.MAX_SAFE_INTEGER
    const secondPriority = second.priority ?? Number.MAX_SAFE_INTEGER

    return firstPriority - secondPriority
  })
  const agreementSubmitted = matches.some((match) => match.agreement_submitted)

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Обновлено
              </Typography>
              <Typography variant="body2">{formatUpdatedAt(admissions.updated_at)}</Typography>
            </Stack>
            <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
              <Typography variant="caption" color="text.secondary">
                Согласие
              </Typography>
              <Chip
                size="small"
                color={agreementSubmitted ? 'success' : 'default'}
                label={agreementSubmitted ? 'Подано' : 'Не подано'}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {admissions.failed_programs > 0 ? (
        <Alert severity="warning">Часть программ не обновилась. Показаны последние доступные данные.</Alert>
      ) : null}
      {matches.length === 0 ? (
        <Alert severity="info">По этому коду пока нет найденных программ.</Alert>
      ) : (
        matches.map((match) => (
          <Card key={`${match.program.id}-${match.program.education_form.id}-${match.program.admission_condition.id}`} variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {match.program.name}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <Chip size="small" label={match.program.education_form.name} />
                    <Chip size="small" label={match.program.admission_condition.name} />
                    {match.passes_now ? (
                      <Chip size="small" color="success" label="Проходишь сейчас" />
                    ) : null}
                  </Stack>
                </Stack>
                <Divider />
                <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                  <Metric label="Позиция" value={formatPosition(match.current_position, match.program.places)} />
                  <Metric label="Баллы" value={formatNumber(match.score)} />
                  <Metric label="Приоритет" value={formatNumber(match.priority)} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Typography variant="h6" component="p">
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
}

function formatPosition(position: number | null, places: number | null) {
  if (position === null) {
    return '—'
  }
  return places === null ? String(position) : `${position}/${places}`
}

function formatNumber(value: number | null) {
  return value === null ? '—' : String(value)
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
