import { createContext, useContext } from 'react'
import type { ScheduleItem } from '../shared/api/users'

export type ActiveScheduleItem = Pick<ScheduleItem, 'item_type' | 'ruz_id'>

export type UserPreferencesContextValue = {
  showBreaks: boolean
  setShowBreaks: (value: boolean) => void
  hidePastLessons: boolean
  setHidePastLessons: (value: boolean) => void
  activeScheduleItem: ActiveScheduleItem | null
  setActiveScheduleItem: (item: ActiveScheduleItem | null) => void
}

export const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null)

export function useUserPreferences() {
  const value = useContext(UserPreferencesContext)
  if (!value) {
    throw new Error('useUserPreferences must be used inside UserPreferencesProvider')
  }

  return value
}
