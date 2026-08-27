import CloseIcon from '@mui/icons-material/Close'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { appMaxWidth } from './layout'
import { useBackOverlay } from './useBackOverlay'

type BottomDrawerProps = {
  open: boolean
  onClose: () => void
  onAfterClose?: () => void
  onExited?: () => void
  title?: string
  fullScreen?: boolean
  height?: number | string
  maxHeight?: number | string
  children: ReactNode
  contentSx?: SxProps<Theme>
}

export function BottomDrawer({
  open,
  onClose,
  onAfterClose,
  onExited,
  title,
  fullScreen = false,
  height,
  maxHeight = fullScreen ? '100dvh' : '90vh',
  children,
  contentSx,
}: BottomDrawerProps) {
  const handleClose = useBackOverlay(open, onClose)
  const handleExited = () => {
    onAfterClose?.()
    onExited?.()
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      onOpen={() => undefined}
      disableDiscovery
      slotProps={{
        root: {
          sx: (theme) => ({
            zIndex: theme.zIndex.drawer,
          }),
        },
        transition: {
          onExited: handleExited,
        },
        paper: {
          sx: (theme) => ({
            height: fullScreen ? '100dvh' : height,
            maxHeight,
            width: '100%',
            maxWidth: appMaxWidth,
            mx: 'auto',
            borderTopLeftRadius: theme.shape.borderRadius,
            borderTopRightRadius: theme.shape.borderRadius,
            overflow: 'hidden',
          }),
        },
      }}
    >
      <Stack sx={{ height: 1, minHeight: 0 }}>
        {fullScreen ? (
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              borderBottom: 1,
              borderColor: 'divider',
              flexShrink: 0,
              minHeight: 56,
              px: 1,
            }}
          >
            <Box sx={{ width: 40 }} />
            <Typography variant="h6" component="h2" noWrap sx={{ flex: 1, textAlign: 'center' }}>
              {title}
            </Typography>
            <IconButton aria-label="Закрыть" color="inherit" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
        ) : (
          <Box
            sx={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              mt: 1.5,
              borderRadius: 999,
              bgcolor: 'divider',
            }}
          />
        )}
        {!fullScreen && title ? (
          <Box sx={{ px: 3, pt: 2, pb: 1 }}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
          </Box>
        ) : null}
        <Box sx={{ flex: 1, minHeight: 0, ...contentSx }}>{children}</Box>
      </Stack>
    </SwipeableDrawer>
  )
}
