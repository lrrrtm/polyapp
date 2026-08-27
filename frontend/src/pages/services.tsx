import AttachFileIcon from '@mui/icons-material/AttachFile'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { lookupDormitoryPayment, submitFeedback, type FeedbackSubject } from '../shared/api/services'
import { useRequiredUser } from '../shared/api/useRequiredUser'
import { queryKeys } from '../shared/api/queryKeys'
import { ActionButton } from '../shared/ui/ActionButton'
import { AppScreen } from '../shared/ui/AppScreen'
import { BottomDrawer } from '../shared/ui/BottomDrawer'
import { CenteredAlert } from '../shared/ui/CenteredAlert'
import { ConfirmDrawer } from '../shared/ui/ConfirmDrawer'
import { CopyToClipboardButton } from '../shared/ui/CopyToClipboardButton'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageSkeleton } from '../shared/ui/PageSkeleton'
import { centeredFixedSurfaceSx } from '../shared/ui/layout'

const dormitoryContractStorageKey = 'polytech:dormitory-payment-contract'
const ePayUrl = 'https://e-pay.spbstu.ru'
const feedbackSuccessLottieSrc = '/animations/feedback-success.json'
const feedbackMaxAttachmentBytes = 10 * 1024 * 1024
const feedbackAttachmentAccept = 'image/*,application/pdf,video/*'
const feedbackSubjects: Array<{ value: FeedbackSubject; label: string }> = [
  { value: 'comment', label: 'Комментарий' },
  { value: 'question', label: 'Вопрос' },
  { value: 'bug', label: 'Сообщение об ошибке' },
  { value: 'feature', label: 'Запрос новой функциональности' },
]

export function ServicesPage() {
  const queryClient = useQueryClient()
  const user = useRequiredUser()
  const [storedContract, setStoredContract] = useState<string | null>(null)
  const [contractInput, setContractInput] = useState('')
  const [contractDrawerOpen, setContractDrawerOpen] = useState(false)
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false)
  const [feedbackDrawerOpen, setFeedbackDrawerOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [contractDeleteConfirmed, setContractDeleteConfirmed] = useState(false)

  useEffect(() => {
    const savedContract = window.localStorage.getItem(dormitoryContractStorageKey)
    if (savedContract) {
      setStoredContract(savedContract)
      setContractInput(savedContract)
    }
  }, [])

  const paymentQuery = useQuery({
    queryKey: queryKeys.dormitoryPayment(storedContract),
    queryFn: () => lookupDormitoryPayment(storedContract ?? ''),
    enabled: user.status === 'ready' && storedContract !== null,
  })
  const contractMutation = useMutation({
    mutationFn: lookupDormitoryPayment,
    onSuccess: (lookup, contract) => {
      if (!lookup.valid) {
        return
      }

      window.localStorage.setItem(dormitoryContractStorageKey, contract)
      setStoredContract(contract)
      setContractInput(contract)
      queryClient.setQueryData(queryKeys.dormitoryPayment(contract), lookup)
      setContractDrawerOpen(false)
    },
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
        maxWidth={false}
        sx={{
          ...centeredFixedSurfaceSx,
          height: '100%',
          overflowY: 'auto',
          pt: 3,
          pb: 10,
        }}
      >
        <Stack spacing={2}>
          <DormitoryPaymentCard
            contract={storedContract}
            lookup={paymentQuery.data}
            loading={paymentQuery.isPending && storedContract !== null}
            error={paymentQuery.isError ? paymentQuery.error.message : null}
            onOpenContract={() => {
              contractMutation.reset()
              setContractInput(storedContract ?? '')
              setContractDrawerOpen(true)
            }}
            onOpenDetails={() => setDetailsDrawerOpen(true)}
          />
          <FeedbackCard onOpen={() => setFeedbackDrawerOpen(true)} />
        </Stack>
        <ContractDrawer
          open={contractDrawerOpen}
          contractInput={contractInput}
          setContractInput={setContractInput}
          loading={contractMutation.isPending}
          lookup={contractMutation.data}
          error={contractMutation.isError ? contractMutation.error.message : null}
          onSubmit={(contract) => contractMutation.mutate(contract)}
          onClose={() => setContractDrawerOpen(false)}
        />
        <PaymentDetailsDrawer
          open={detailsDrawerOpen}
          lookup={paymentQuery.data}
          loading={paymentQuery.isPending && storedContract !== null}
          error={paymentQuery.isError ? paymentQuery.error.message : null}
          onClose={() => setDetailsDrawerOpen(false)}
          onForget={() => setDeleteConfirmOpen(true)}
        />
        <FeedbackDrawer open={feedbackDrawerOpen} onClose={() => setFeedbackDrawerOpen(false)} />
        <DeleteContractDrawer
          open={deleteConfirmOpen}
          contract={storedContract}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={() => {
            window.localStorage.removeItem(dormitoryContractStorageKey)
            setContractDeleteConfirmed(true)
            setDeleteConfirmOpen(false)
            setDetailsDrawerOpen(false)
          }}
          onExited={() => {
            if (!contractDeleteConfirmed) {
              return
            }

            setStoredContract(null)
            setContractInput('')
            setContractDeleteConfirmed(false)
          }}
        />
      </Container>
    </AppScreen>
  )
}

function FeedbackCard({ onOpen }: { onOpen: () => void }) {
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
      <CardActionArea onClick={onOpen} sx={{ textAlign: 'left' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" component="h1">
                Обратная связь
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Помоги нам сделать приложение лучше
              </Typography>
            </Stack>
            <ChevronRightIcon color="action" sx={{ flexShrink: 0 }} />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

function FeedbackDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState<FeedbackSubject>('comment')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const feedbackMutation = useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      setSubject('comment')
      setMessage('')
      setContact('')
      setAttachment(null)
      setFileError(null)
      setSubmitted(true)
    },
  })
  const trimmedMessage = message.trim()
  const trimmedContact = contact.trim()
  const canSubmit = trimmedMessage.length > 0 && trimmedContact.length > 0 && !fileError && !feedbackMutation.isPending

  function reset() {
    setSubject('comment')
    setMessage('')
    setContact('')
    setAttachment(null)
    setFileError(null)
    setSubmitted(false)
    feedbackMutation.reset()
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    feedbackMutation.mutate({
      subject,
      message: trimmedMessage,
      contact: trimmedContact,
      attachment,
    })
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    setFileError(null)

    if (!file) {
      return
    }

    if (file.size > feedbackMaxAttachmentBytes) {
      setAttachment(null)
      setFileError('Файл слишком большой. Максимальный размер — 10 МБ.')
      return
    }

    if (!isAllowedFeedbackAttachment(file)) {
      setAttachment(null)
      setFileError('Можно приложить только картинку, PDF или видео.')
      return
    }

    setAttachment(file)
  }

  return (
    <BottomDrawer
      open={open}
      onClose={handleClose}
      title="Обратная связь"
      fullScreen
      contentSx={{ overflowY: 'auto' }}
    >
      <Stack component="form" spacing={2.5} sx={{ px: 3, pt: 2, pb: 4 }} onSubmit={handleSubmit}>
        {submitted ? (
          <EmptyState
            lottieSrc={feedbackSuccessLottieSrc}
            title="Спасибо!"
            description="Мы получили твоё обращение"
            actionLabel="Закрыть"
            onAction={handleClose}
            sx={{ minHeight: 'calc(100dvh - 104px)' }}
          />
        ) : (
          <>
            <TextField
              select
              required
              label="Тема твоего обращения"
              value={subject}
              onChange={(event) => setSubject(event.target.value as FeedbackSubject)}
              disabled={feedbackMutation.isPending}
              fullWidth
            >
              {feedbackSubjects.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              label="Сообщение"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={feedbackMutation.isPending}
              multiline
              minRows={5}
              slotProps={{ htmlInput: { maxLength: 4000 } }}
              fullWidth
            />
            <Stack spacing={1}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<AttachFileIcon />}
                disabled={feedbackMutation.isPending}
                fullWidth
              >
                {attachment ? 'Заменить файл' : 'Присоединить файл'}
                <Box
                  component="input"
                  type="file"
                  accept={feedbackAttachmentAccept}
                  sx={{ display: 'none' }}
                  onChange={handleAttachmentChange}
                />
              </Button>
              {attachment ? (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                    {attachment.name}
                  </Typography>
                  <IconButton
                    aria-label="Удалить файл"
                    size="small"
                    onClick={() => setAttachment(null)}
                    disabled={feedbackMutation.isPending}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ) : null}
              {fileError ? <Alert severity="error">{fileError}</Alert> : null}
            </Stack>
            <TextField
              required
              label="Контакт для связи"
              placeholder="@username, vk.com/..., email@example.com"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              disabled={feedbackMutation.isPending}
              slotProps={{ htmlInput: { maxLength: 200 } }}
              fullWidth
            />
            {feedbackMutation.isError ? <Alert severity="error">{feedbackMutation.error.message}</Alert> : null}
            <ActionButton type="submit" disabled={!canSubmit} loading={feedbackMutation.isPending}>
              Отправить
            </ActionButton>
          </>
        )}
      </Stack>
    </BottomDrawer>
  )
}

function isAllowedFeedbackAttachment(file: File) {
  return file.type === 'application/pdf' || file.type.startsWith('image/') || file.type.startsWith('video/')
}

function DormitoryPaymentCard({
  contract,
  lookup,
  loading,
  error,
  onOpenContract,
  onOpenDetails,
}: {
  contract: string | null
  lookup?: Awaited<ReturnType<typeof lookupDormitoryPayment>>
  loading: boolean
  error: string | null
  onOpenContract: () => void
  onOpenDetails: () => void
}) {
  const amountDue = lookup?.amount_due ?? 0

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
      <CardContentRoot interactive={contract !== null} onClick={contract ? onOpenDetails : undefined}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {contract ? (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" component="h1">
                  Оплата общежития
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {contract}
                </Typography>
              </Stack>
              <Box sx={{ flexShrink: 0, minWidth: 108, textAlign: 'right' }}>
                <WidgetAmount lookup={lookup} loading={loading} error={error} amountDue={amountDue} />
              </Box>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" component="h1">
                  Оплата общежития
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Номер договора не указан
                </Typography>
              </Stack>
              <Button variant="contained" size="large" onClick={onOpenContract} fullWidth>
                Указать номер договора
              </Button>
            </Stack>
          )}
        </CardContent>
      </CardContentRoot>
    </Card>
  )
}

function DeleteContractDrawer({
  open,
  contract,
  onClose,
  onConfirm,
  onExited,
}: {
  open: boolean
  contract: string | null
  onClose: () => void
  onConfirm: () => void
  onExited: () => void
}) {
  return (
    <ConfirmDrawer
      open={open}
      onClose={onClose}
      onExited={onExited}
      title="Удаление номера договора"
      message={`Удалить номер договора ${contract ?? ''} с этого устройства?`}
      confirmLabel="Удалить"
      confirmColor="error"
      onConfirm={onConfirm}
    />
  )
}

function CardContentRoot({
  interactive,
  onClick,
  children,
}: {
  interactive: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return interactive ? (
    <CardActionArea onClick={onClick} sx={{ textAlign: 'left' }}>
      {children}
    </CardActionArea>
  ) : (
    children
  )
}

function WidgetAmount({
  lookup,
  loading,
  error,
  amountDue,
}: {
  lookup?: Awaited<ReturnType<typeof lookupDormitoryPayment>>
  loading: boolean
  error: string | null
  amountDue: number
}) {
  if (loading) {
    return <Skeleton variant="text" width={108} height={36} sx={{ ml: 'auto' }} />
  }

  if (error) {
    return (
      <Typography variant="body2" color="error">
        Не удалось обновить
      </Typography>
    )
  }

  if (!lookup?.valid) {
    return (
      <Typography variant="body2" color="warning.main">
        Номер договора не найден
      </Typography>
    )
  }

  return (
    <Typography variant="h5" component="p" color={amountDue > 0 ? 'text.primary' : 'success.main'}>
      {amountDue > 0 ? formatRubles(amountDue) : 'Оплачено'}
    </Typography>
  )
}

function ContractDrawer({
  open,
  contractInput,
  setContractInput,
  loading,
  lookup,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean
  contractInput: string
  setContractInput: (value: string) => void
  loading: boolean
  lookup?: Awaited<ReturnType<typeof lookupDormitoryPayment>>
  error: string | null
  onSubmit: (contract: string) => void
  onClose: () => void
}) {
  const trimmedContract = contractInput.trim()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (trimmedContract) {
      onSubmit(trimmedContract)
    }
  }

  return (
    <BottomDrawer open={open} onClose={onClose} title="Номер договора">
      <Stack component="form" spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }} onSubmit={handleSubmit}>
        <TextField
          value={contractInput}
          placeholder="Номер договора"
          onChange={(event) => setContractInput(event.target.value)}
          disabled={loading}
          autoFocus
          fullWidth
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
        {lookup?.valid === false ? <Alert severity="warning">Номер договора не найден. Проверь его и попробуй снова.</Alert> : null}
        <ActionButton type="submit" disabled={!trimmedContract} loading={loading}>
          Сохранить
        </ActionButton>
        <Typography variant="body2" color="text.secondary">
          Номер договора сохранится только на этом устройстве.
        </Typography>
      </Stack>
    </BottomDrawer>
  )
}

function PaymentDetailsDrawer({
  open,
  lookup,
  loading,
  error,
  onClose,
  onForget,
}: {
  open: boolean
  lookup?: Awaited<ReturnType<typeof lookupDormitoryPayment>>
  loading: boolean
  error: string | null
  onClose: () => void
  onForget: () => void
}) {
  const amountDue = lookup?.amount_due ?? 0

  return (
    <BottomDrawer open={open} onClose={onClose} title="Оплата общежития">
      <Stack>
        <Box sx={{ maxHeight: '56vh', overflowY: 'auto', px: 3, pt: 1, pb: 2 }}>
          {loading ? <DormitoryPaymentSkeleton /> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {!loading && !error && lookup ? <DormitoryPaymentStatus lookup={lookup} amountDue={amountDue} /> : null}
        </Box>
        <Stack spacing={1.5} sx={{ px: 3, pb: 4, pt: 1 }}>
          <Button
            variant="contained"
            size="large"
            href={ePayUrl}
            target="_blank"
            rel="noreferrer"
            endIcon={<OpenInNewIcon />}
            disabled={lookup?.valid !== true}
            fullWidth
          >
            Перейти к оплате
          </Button>
          <Button variant="outlined" color="error" size="large" onClick={onForget} fullWidth>
            Удалить номер договора
          </Button>
        </Stack>
      </Stack>
    </BottomDrawer>
  )
}

function DormitoryPaymentStatus({
  lookup,
  amountDue,
}: {
  lookup: Awaited<ReturnType<typeof lookupDormitoryPayment>>
  amountDue: number
}) {
  const contract = lookup.contract ?? 'Не указан'

  if (!lookup.valid) {
    return <Alert severity="warning">Номер договора не найден. Проверь его и попробуй снова.</Alert>
  }

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Номер договора
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="body1" noWrap sx={{ minWidth: 0 }}>
            {contract}
          </Typography>
          {lookup.contract ? <CopyToClipboardButton value={lookup.contract} sx={{ flexShrink: 0 }} /> : null}
        </Stack>
      </Stack>
      <Divider />
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Плательщик
        </Typography>
        <Typography variant="body1">{lookup.payer_name ?? 'Не указан'}</Typography>
      </Stack>
      {lookup.additional ? (
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Общежитие
          </Typography>
          <Typography variant="body1">{lookup.additional.trim()}</Typography>
        </Stack>
      ) : null}
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Задолженность
        </Typography>
        <Typography variant="h5" component="p">
          {amountDue > 0 ? formatRubles(amountDue) : 'Нет задолженности'}
        </Typography>
      </Stack>
    </Stack>
  )
}

function DormitoryPaymentSkeleton() {
  return (
    <Stack spacing={1.5}>
      <Skeleton variant="text" width="62%" />
      <Skeleton variant="text" width="84%" />
      <Skeleton variant="text" width="38%" height={36} />
    </Stack>
  )
}

function formatRubles(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value)
}
