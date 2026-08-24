import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Container from '@mui/material/Container'
import Slide from '@mui/material/Slide'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GradFlow } from 'gradflow'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { appConfig } from '../app/config'
import { setApplicantCode } from '../shared/api/admissions'
import { queryKeys } from '../shared/api/queryKeys'
import { type Faculty, type Group, getFaculties, getGroupsByFaculty } from '../shared/api/ruz'
import { createCurrentUser, getSessionStatus, setPrimaryGroup, setUserProfileApplicantCode, type UserProfile } from '../shared/api/users'
import { ActionButton } from '../shared/ui/ActionButton'
import { AppAutocomplete } from '../shared/ui/AppAutocomplete'
import { ApplicantCodeStep } from '../shared/ui/ApplicantCodeStep'
import { PageSkeleton } from '../shared/ui/PageSkeleton'

export function HelloPage() {
  const theme = useTheme()
  const darkMode = theme.palette.mode === 'dark'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'hello' | 'applicant' | 'group' | 'done'>('hello')
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [applicantCode, setApplicantCodeValue] = useState('')
  const [applicantCodeSaved, setApplicantCodeSaved] = useState(false)
  const [leavingToApp, setLeavingToApp] = useState(false)
  const sessionQuery = useQuery({
    queryKey: queryKeys.session(),
    queryFn: getSessionStatus,
  })
  const facultiesQuery = useQuery({
    queryKey: queryKeys.faculties(),
    queryFn: getFaculties,
    enabled: step === 'group',
  })
  const groupsQuery = useQuery({
    queryKey: queryKeys.facultyGroups(faculty?.id),
    queryFn: () => getGroupsByFaculty(faculty?.id ?? 0),
    enabled: step === 'group' && faculty !== null,
  })
  const createUserMutation = useMutation({
    mutationFn: createCurrentUser,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.me(), profile)
      queryClient.setQueryData(queryKeys.session(), { hasUser: true })
      setStep(appConfig.VITE_ADMISSIONS_ENABLED ? 'applicant' : 'group')
    },
  })
  const saveMutation = useMutation({
    mutationFn: () => setPrimaryGroup(group?.id ?? 0),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.me(), profile)
      await queryClient.invalidateQueries({ queryKey: queryKeys.session() })
      setStep('done')
    },
  })
  const saveApplicantCodeMutation = useMutation({
    mutationFn: () => setApplicantCode(applicantCode.trim()),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.me(), (currentProfile: UserProfile | undefined) =>
        setUserProfileApplicantCode(currentProfile, profile),
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.admissions() })
      setApplicantCodeSaved(true)
      setStep('done')
    },
  })

  const trimmedApplicantCode = applicantCode.trim()
  const canSaveApplicantCode = /^\d+$/.test(trimmedApplicantCode)
  const donePath = appConfig.VITE_ADMISSIONS_ENABLED && applicantCodeSaved ? '/freshman' : '/schedule'
  const helloDescription = appConfig.VITE_ADMISSIONS_ENABLED
    ? 'Это супер-апп политеха, в котором ты сможешь удобно просматривать расписание, отслеживать своё положение при поступлении и делать много разного. Начнём?'
    : 'Это супер-апп политеха, в котором ты сможешь удобно просматривать расписание и делать много разного. Начнём?'

  useEffect(() => {
    if (step !== 'done') {
      return
    }

    const timeoutId = window.setTimeout(() => setLeavingToApp(true), 800)
    return () => window.clearTimeout(timeoutId)
  }, [step])

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
      <Box
        component={motion.div}
        animate={{ x: leavingToApp ? -28 : 0 }}
        transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
        onAnimationComplete={() => {
          if (leavingToApp) {
            navigate(donePath, { replace: true })
          }
        }}
        sx={{
          position: 'absolute',
          inset: 0,
          width: 1,
          minHeight: '100svh',
          overflow: 'hidden',
          bgcolor: 'background.default',
          willChange: 'transform',
        }}
      >
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
                      {helloDescription}
                    </Typography>
                  </Stack>
                  <ActionButton
                    onClick={() => createUserMutation.mutate()}
                    loading={createUserMutation.isPending}
                    sx={{ py: 1.5 }}
                  >
                    Вперёд
                  </ActionButton>
                  {createUserMutation.isError ? (
                    <Alert severity="error">Не удалось начать работу. Попробуй ещё раз.</Alert>
                  ) : null}
                </Stack>
              </Box>
            </Slide>
            {appConfig.VITE_ADMISSIONS_ENABLED ? (
              <Slide direction="up" in={step === 'applicant'} timeout={360} mountOnEnter unmountOnExit>
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                  <ApplicantCodeStep
                    code={applicantCode}
                    canContinue={canSaveApplicantCode}
                    isSaving={saveApplicantCodeMutation.isPending}
                    saveError={saveApplicantCodeMutation.error}
                    onCodeChange={(code) => {
                      saveApplicantCodeMutation.reset()
                      setApplicantCodeValue(code)
                    }}
                    onContinue={() => saveApplicantCodeMutation.mutate()}
                    onSkip={() => setStep('group')}
                  />
                </Box>
              </Slide>
            ) : null}
            <Slide direction="up" in={step === 'group'} timeout={360} mountOnEnter unmountOnExit>
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                <Stack spacing={4} sx={{ width: 1, pb: { xs: 4, sm: 0 } }}>
                  <Stack spacing={1}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                      Уже учишься?
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Выбери свой институт и учебную группу, чтобы получить доступ к расписанию
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
                    <Stack spacing={1.5}>
                      <ActionButton
                        disabled={group === null}
                        loading={saveMutation.isPending}
                        onClick={() => saveMutation.mutate()}
                        sx={{ py: 1.5 }}
                      >
                        Далее
                      </ActionButton>
                      <Button
                        variant="text"
                        size="large"
                        fullWidth
                        disabled={saveMutation.isPending}
                        onClick={() => setStep('done')}
                        sx={{ py: 1.5 }}
                      >
                        Пропустить
                      </Button>
                    </Stack>
                  </Stack>
                  {saveMutation.isError ? (
                    <Alert severity="error">Не удалось сохранить группу. Попробуй ещё раз.</Alert>
                  ) : null}
                </Stack>
              </Box>
            </Slide>
            <Slide direction="up" in={step === 'done'} timeout={360} mountOnEnter unmountOnExit>
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                <Stack spacing={2.5} sx={{ width: 1, alignItems: 'center', textAlign: 'center', pb: { xs: 4, sm: 0 } }}>
                  <CheckCircleIcon color="primary" sx={{ fontSize: 56 }} />
                  <Stack spacing={1}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                      Готово
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Загружаем данные
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Slide>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
