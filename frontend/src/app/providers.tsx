import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import 'dayjs/locale/ru'
import { preloadEmptyStateLotties } from '../shared/ui/empty-state-lotties'
import { queryClient } from './query-client'
import { router } from './router'
import { ThemePreferenceProvider } from './theme-preference'
import { UserPreferencesProvider } from './user-preferences'

export function AppProviders() {
  useEffect(() => {
    void preloadEmptyStateLotties()
  }, [])

  return (
    <ThemePreferenceProvider>
      <UserPreferencesProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </LocalizationProvider>
      </UserPreferencesProvider>
    </ThemePreferenceProvider>
  )
}
