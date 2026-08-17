import type { SvgIconComponent } from '@mui/icons-material'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import type { SxProps, Theme } from '@mui/material/styles'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

type EmptyStateProps = {
  icon: SvgIconComponent
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  sx?: SxProps<Theme>
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, sx }: EmptyStateProps) {
  return (
    <Box sx={[{ minHeight: 'calc(100vh - 96px)', display: 'grid', placeItems: 'center', px: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <Icon color="disabled" sx={{ fontSize: 56 }} aria-hidden />
        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="h6" component="p">
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Stack>
        {actionLabel ? (
          <Button variant="contained" size="large" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  )
}
