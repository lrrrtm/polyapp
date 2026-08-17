import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

type ApplicantCodeStepProps = {
  code: string
  canContinue: boolean
  isSaving: boolean
  saveError: Error | null
  onCodeChange: (code: string) => void
  onContinue: () => void
  onSkip?: () => void
}

export function ApplicantCodeStep({
  code,
  canContinue,
  isSaving,
  saveError,
  onCodeChange,
  onContinue,
  onSkip,
}: ApplicantCodeStepProps) {
  const trimmedCode = code.trim()
  const formatError = trimmedCode.length > 0 && !canContinue
  const helperText = formatError ? 'Код должен состоять только из цифр.' : saveError?.message

  return (
    <Stack spacing={4} sx={{ width: 1, pb: { xs: 4, sm: 0 } }}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Поступаешь?
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Введи код поступающего с Госуслуг, чтобы отслеживать своё положение в конкурсных списках
        </Typography>
      </Stack>
      <Stack spacing={2.5}>
        <TextField
          label="Уникальный код поступающего"
          value={code}
          inputMode="numeric"
          autoComplete="off"
          fullWidth
          error={formatError || saveError !== null}
          helperText={helperText}
          onChange={(event) => onCodeChange(event.target.value.replace(/\s/g, ''))}
        />
        <Stack spacing={1.5}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={!canContinue}
            loading={isSaving}
            onClick={onContinue}
            sx={{ py: 1.5 }}
          >
            Далее
          </Button>
          {onSkip ? (
            <Button
              variant="text"
              size="large"
              fullWidth
              disabled={isSaving}
              onClick={onSkip}
              sx={{ py: 1.5 }}
            >
              Пропустить
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  )
}
