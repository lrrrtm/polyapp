import Button from '@mui/material/Button'
import type { ButtonProps } from '@mui/material/Button'

type ActionButtonProps = ButtonProps & {
  loading?: boolean
}

export function ActionButton({
  size = 'large',
  fullWidth = true,
  variant = 'contained',
  loading = false,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <Button size={size} fullWidth={fullWidth} variant={variant} loading={loading} {...props}>
      {children}
    </Button>
  )
}
