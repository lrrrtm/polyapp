import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Slide from '@mui/material/Slide'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GradFlow } from 'gradflow'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { type Faculty, type Group, getFaculties, getGroupsByFaculty } from '../shared/api/ruz'
import { createCurrentUser, getSessionStatus, setPrimaryGroup } from '../shared/api/users'
import { AppAutocomplete } from '../shared/ui/AppAutocomplete'
import { PageSkeleton } from '../shared/ui/PageSkeleton'

export function HelloPage() {
  const theme = useTheme()
  const darkMode = theme.palette.mode === 'dark'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'hello' | 'register'>('hello')
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSessionStatus,
  })
  const facultiesQuery = useQuery({
    queryKey: ['faculties'],
    queryFn: getFaculties,
    enabled: step === 'register',
  })
  const groupsQuery = useQuery({
    queryKey: ['faculty-groups', faculty?.id],
    queryFn: () => getGroupsByFaculty(faculty?.id ?? 0),
    enabled: step === 'register' && faculty !== null,
  })
  const createUserMutation = useMutation({
    mutationFn: createCurrentUser,
    onSuccess: (profile) => {
      queryClient.setQueryData(['me'], profile)
      queryClient.setQueryData(['session'], { hasUser: true })
      setStep('register')
    },
  })
  const saveMutation = useMutation({
    mutationFn: () => setPrimaryGroup(group?.id ?? 0),
    onSuccess: async (profile) => {
      queryClient.setQueryData(['me'], profile)
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate('/schedule', { replace: true })
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

  if (sessionQuery.data.hasUser && step === 'hello') {
    return <Navigate to="/" replace />
  }

  return (
    <Box sx={{ position: 'relative', minHeight: '100svh', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Box sx={{ position: 'absolute', inset: 0, opacity: 0.42 }}>
        <GradFlow
          config={{
            color1: darkMode ? { r: 36, g: 65, b: 40 } : { r: 86, g: 150, b: 91 },
            color2: darkMode ? { r: 8, g: 13, b: 10 } : { r: 255, g: 255, b: 255 },
            color3: darkMode ? { r: 55, g: 179, b: 74 } : { r: 196, g: 230, b: 199 },
            speed: 0.45,
            scale: 1.35,
            type: 'animated',
            noise: 0,
          }}
        />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: darkMode ? 'rgba(18, 18, 18, 0.62)' : 'rgba(255, 255, 255, 0.58)',
        }}
      />
      <Container
        maxWidth="sm"
        sx={{
          position: 'relative',
          minHeight: '100svh',
          px: 3,
          py: 4,
        }}
      >
        <Box sx={{ position: 'relative', minHeight: 'calc(100svh - 64px)', overflow: 'hidden' }}>
          <Slide direction="down" in={step === 'hello'} timeout={360} appear={false} mountOnEnter unmountOnExit>
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
            <Stack spacing={4} sx={{ width: 1, alignItems: 'stretch', pb: { xs: 4, sm: 0 } }}>
              <Stack spacing={2}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  Привет!
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420 }}>
                  Здесь ты сможешь быстро и удобно смотреть расписание занятий, преподавателей и аудиторий
                  Политеха. Начнём?
                </Typography>
              </Stack>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => createUserMutation.mutate()}
                loading={createUserMutation.isPending}
                sx={{ py: 1.5 }}
              >
                Вперёд
              </Button>
              {createUserMutation.isError ? (
                <Alert severity="error">Не удалось начать работу. Попробуй ещё раз.</Alert>
              ) : null}
            </Stack>
            </Box>
          </Slide>
          <Slide direction="up" in={step === 'register'} timeout={360} mountOnEnter unmountOnExit>
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
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
            </Box>
          </Slide>
        </Box>
      </Container>
    </Box>
  )
}
