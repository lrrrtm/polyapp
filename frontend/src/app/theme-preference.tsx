import CssBaseline from '@mui/material/CssBaseline'
import useMediaQuery from '@mui/material/useMediaQuery'
import { ThemeProvider, type PaletteMode } from '@mui/material/styles'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { createAppTheme } from './theme'
import { ThemePreferenceContext, type ThemePreference } from './theme-preference-context'

const themePreferenceStorageKey = 'polytech_theme'

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => readStoredThemePreference())
  const paletteMode: PaletteMode = themePreference === 'system' ? (prefersDarkMode ? 'dark' : 'light') : themePreference
  const theme = useMemo(() => createAppTheme(paletteMode), [paletteMode])

  function setThemePreference(preference: ThemePreference) {
    setThemePreferenceState(preference)
    localStorage.setItem(themePreferenceStorageKey, preference)
  }

  useEffect(() => {
    document.documentElement.style.colorScheme = paletteMode
  }, [paletteMode])

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference,
    }),
    [themePreference],
  )

  return (
    <ThemePreferenceContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemePreferenceContext.Provider>
  )
}

function readStoredThemePreference(): ThemePreference {
  const preference = localStorage.getItem(themePreferenceStorageKey)
  return preference === 'light' || preference === 'dark' || preference === 'system' ? preference : 'system'
}
