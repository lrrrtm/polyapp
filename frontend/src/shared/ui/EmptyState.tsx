import type { SvgIconComponent } from '@mui/icons-material'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

type EmptyStateProps = {
  icon: SvgIconComponent
  title: string
  description?: string
  sx?: SxProps<Theme>
}

export function EmptyState({ icon: Icon, title, description, sx }: EmptyStateProps) {
  return (
    <Box sx={[{ minHeight: 'calc(100vh - 96px)', display: 'grid', placeItems: 'center', px: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <Icon color="disabled" sx={{ fontSize: 56 }} aria-hidden />
        <Stack spacing={0.5}>
          <Typography variant="h6" component="p">
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  )
}
