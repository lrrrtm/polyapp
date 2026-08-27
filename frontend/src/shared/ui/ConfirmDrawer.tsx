import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import type { ButtonProps } from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { ActionButton } from './ActionButton'
import { BottomDrawer, BottomDrawerContent } from './BottomDrawer'

type ConfirmDrawerProps = {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  confirmColor?: ButtonProps['color']
  confirmDisabled?: boolean
  confirmLoading?: boolean
  cancelLabel?: string
  error?: ReactNode
  onClose: () => void
  onConfirm: () => void
  onExited?: () => void
}

export function ConfirmDrawer({
  open,
  title,
  message,
  confirmLabel,
  confirmColor,
  confirmDisabled,
  confirmLoading,
  cancelLabel = 'Отмена',
  error,
  onClose,
  onConfirm,
  onExited,
}: ConfirmDrawerProps) {
  return (
    <BottomDrawer open={open} onClose={onClose} onExited={onExited} title={title}>
      <BottomDrawerContent spacing={2.5}>
        <Typography variant="body1">{message}</Typography>
        <Stack direction="row" spacing={1.25}>
          <Button variant="outlined" size="large" disabled={confirmLoading} onClick={onClose} fullWidth>
            {cancelLabel}
          </Button>
          <ActionButton color={confirmColor} disabled={confirmDisabled} loading={confirmLoading} onClick={onConfirm}>
            {confirmLabel}
          </ActionButton>
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
      </BottomDrawerContent>
    </BottomDrawer>
  )
}
