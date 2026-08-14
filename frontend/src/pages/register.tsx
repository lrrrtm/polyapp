import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { type Faculty, type Group, getFaculties, getGroupsByFaculty } from '../shared/api/ruz'
import { getCurrentUser, getSessionStatus, setPrimaryGroup } from '../shared/api/users'
import { AppAutocomplete } from '../shared/ui/AppAutocomplete'
import { PageSkeleton } from '../shared/ui/PageSkeleton'

export function RegisterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [group, setGroup] = useState<Group | null>(null)

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSessionStatus,
  })
  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    enabled: sessionQuery.data?.hasUser === true,
  })
  const facultiesQuery = useQuery({
    queryKey: ['faculties'],
    queryFn: getFaculties,
    enabled: sessionQuery.data?.hasUser === true,
  })
  const groupsQuery = useQuery({
    queryKey: ['faculty-groups', faculty?.id],
    queryFn: () => getGroupsByFaculty(faculty?.id ?? 0),
    enabled: faculty !== null,
  })
  const saveMutation = useMutation({
    mutationFn: () => setPrimaryGroup(group?.id ?? 0),
    onSuccess: async (profile) => {
      queryClient.setQueryData(['me'], profile)
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate('/', { replace: true })
    },
  })

  if (sessionQuery.isPending) {
    return <PageSkeleton show />
  }

  if (sessionQuery.isError) {
    return (
      <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
        <Alert severity="error">Не удалось проверить сессию.</Alert>
      </Container>
    )
  }

  if (!sessionQuery.data.hasUser) {
    return <Navigate to="/hello" replace />
  }

  if (profileQuery.isPending) {
    return <PageSkeleton show />
  }

  if (profileQuery.isError) {
    return (
      <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
        <Alert severity="error">Не удалось загрузить профиль.</Alert>
      </Container>
    )
  }

  if (profileQuery.data.primary_group) {
    return <Navigate to="/" replace />
  }

  return (
    <Box
      sx={{
        minHeight: '100svh',
        bgcolor: 'background.default',
        backgroundImage: 'linear-gradient(180deg, rgba(86, 150, 91, 0.12), rgba(255, 255, 255, 0) 42%)',
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 4,
        }}
      >
        <Stack spacing={4} sx={{ width: 1, pb: { xs: 4, sm: 0 } }}>
          <Stack spacing={1}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Познакомимся?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Выбери институт и свою учебную группу
            </Typography>
          </Stack>
          <Stack spacing={2.5}>
            <AppAutocomplete
              options={facultiesQuery.data ?? []}
              value={faculty}
              label="Институт"
              loading={facultiesQuery.isPending}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="Институты не найдены"
              error={facultiesQuery.isError}
              helperText={facultiesQuery.isError ? 'Не удалось загрузить институты.' : undefined}
              onChange={(value) => {
                setFaculty(value)
                setGroup(null)
              }}
            />
            <AppAutocomplete
              options={groupsQuery.data ?? []}
              value={group}
              label="Группа"
              loading={groupsQuery.isPending}
              disabled={faculty === null}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="Группы не найдены"
              error={groupsQuery.isError}
              helperText={groupsQuery.isError ? 'Не удалось загрузить группы.' : undefined}
              onChange={(value) => {
                setGroup(value)
              }}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={group === null}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              sx={{ py: 1.5 }}
            >
              Сохранить
            </Button>
          </Stack>
          {saveMutation.isError ? (
            <Alert severity="error">Не удалось сохранить группу. Попробуй ещё раз.</Alert>
          ) : null}
        </Stack>
      </Container>
    </Box>
  )
}
