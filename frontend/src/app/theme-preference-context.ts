import { createContext, useContext } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

export type ThemePreferenceContextValue = {
  themePreference: ThemePreference
  setThemePreference: (preference: ThemePreference) => void
}

export const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null)

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext)
  if (!value) {
    throw new Error('useThemePreference must be used inside ThemePreferenceProvider')
  }

  return value
}
