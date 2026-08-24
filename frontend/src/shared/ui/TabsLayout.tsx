import Box from '@mui/material/Box'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useLocation, useOutlet } from 'react-router'
import { appConfig } from '../../app/config'
import { AppBottomNavigation } from './AppBottomNavigation'

const tabPaths = appConfig.VITE_ADMISSIONS_ENABLED
  ? ['/freshman', '/schedule', '/services', '/settings']
  : ['/schedule', '/services', '/settings']

export function TabsLayout() {
  const location = useLocation()
  const outlet = useOutlet()
  const currentIndex = getTabIndex(location.pathname)
  const previousIndex = useRef(currentIndex)
  const direction = currentIndex >= previousIndex.current ? 1 : -1

  useEffect(() => {
    previousIndex.current = currentIndex
  }, [currentIndex])

  return (
    <Box sx={{ position: 'relative', height: '100svh', overflow: 'hidden' }}>
      <AnimatePresence initial={false} custom={direction}>
        <Box
          key={location.pathname}
          component={motion.div}
          custom={direction}
          initial={{ x: direction * 28 }}
          animate={{ x: 0 }}
          exit={{ x: direction * -28 }}
          transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
          sx={{ position: 'absolute', inset: 0, zIndex: 0, width: 1, willChange: 'transform' }}
        >
          {outlet}
        </Box>
      </AnimatePresence>
      <AppBottomNavigation />
    </Box>
  )
}

function getTabIndex(pathname: string) {
  const index = tabPaths.findIndex((path) => pathname.startsWith(path))
  return index >= 0 ? index : 0
}
