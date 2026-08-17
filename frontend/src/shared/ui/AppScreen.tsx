import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ElementType, ReactNode } from 'react'
import { appMaxWidth } from './layout'

type AppScreenProps = {
  children: ReactNode
  component?: ElementType
  sx?: SxProps<Theme>
}

export function AppScreen({ children, component, sx }: AppScreenProps) {
  const screenSx = [
    { height: '100svh', maxWidth: appMaxWidth, mx: 'auto', overflow: 'hidden', bgcolor: 'background.default' },
    ...(Array.isArray(sx) ? sx : [sx]),
  ]

  if (component) {
    return (
      <Box component={component} sx={screenSx}>
        {children}
      </Box>
    )
  }

  return (
    <Box sx={screenSx}>
      {children}
    </Box>
  )
}
