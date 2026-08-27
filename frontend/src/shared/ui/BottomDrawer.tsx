import Box from '@mui/material/Box'
import List from '@mui/material/List'
import type { ListProps } from '@mui/material/List'
import Stack from '@mui/material/Stack'
import type { StackProps } from '@mui/material/Stack'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ElementType, ReactNode } from 'react'
import { appMaxWidth } from './layout'
import { useBackOverlay } from './useBackOverlay'

type BottomDrawerProps = {
  open: boolean
  onClose: () => void
  onAfterClose?: () => void
  onExited?: () => void
  title?: string
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
  height,
  maxHeight = '90vh',
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
            height,
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
      <Stack sx={{ height: height ? 1 : 'auto', maxHeight: 'inherit', minHeight: 0 }}>
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
        {title ? (
          <Box sx={{ px: 3, pt: 2, pb: 1 }}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
          </Box>
        ) : null}
        <Box
          sx={[
            {
              flex: height ? 1 : '0 1 auto',
              minHeight: 0,
              overflowY: 'auto',
            },
            ...(Array.isArray(contentSx) ? contentSx : [contentSx]),
          ]}
        >
          {children}
        </Box>
      </Stack>
    </SwipeableDrawer>
  )
}

export function BottomDrawerContent<RootComponent extends ElementType = 'div'>({ sx, ...props }: StackProps<RootComponent>) {
  return (
    <Stack
      {...props}
      sx={[
        {
          px: 3,
          pt: 1,
          pb: 4,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}

export function BottomDrawerSearch<RootComponent extends ElementType = 'div'>({ sx, ...props }: StackProps<RootComponent>) {
  return (
    <Stack
      {...props}
      sx={[
        {
          px: 3,
          pb: 2,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}

export function BottomDrawerList({ sx, ...props }: ListProps) {
  return (
    <List
      {...props}
      sx={[
        {
          overflowY: 'auto',
          pb: 2,
          '& .MuiListItemButton-root': {
            px: 3,
          },
          '& .MuiListItemIcon-root': {
            minWidth: 40,
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}

export function BottomDrawerActions<RootComponent extends ElementType = 'div'>({ sx, ...props }: StackProps<RootComponent>) {
  return (
    <Stack
      {...props}
      sx={[
        {
          px: 3,
          pt: 1,
          pb: 4,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  )
}
