import { type ReactNode, useMemo, useState } from 'react'
import { type ActiveScheduleItem, UserPreferencesContext } from './user-preferences-context'

const showBreaksStorageKey = 'polytech_show_breaks'
const hidePastLessonsStorageKey = 'polytech_hide_past_lessons'
const activeScheduleItemStorageKey = 'polytech_active_schedule_item'

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [showBreaks, setShowBreaksState] = useState(() => readStoredBoolean(showBreaksStorageKey, true))
  const [hidePastLessons, setHidePastLessonsState] = useState(() => readStoredBoolean(hidePastLessonsStorageKey, false))
  const [activeScheduleItem, setActiveScheduleItemState] = useState<ActiveScheduleItem | null>(() =>
    readStoredActiveScheduleItem(),
  )

  function setShowBreaks(value: boolean) {
    setShowBreaksState(value)
    localStorage.setItem(showBreaksStorageKey, String(value))
  }

  function setHidePastLessons(value: boolean) {
    setHidePastLessonsState(value)
    localStorage.setItem(hidePastLessonsStorageKey, String(value))
  }

  function setActiveScheduleItem(item: ActiveScheduleItem | null) {
    setActiveScheduleItemState(item)
    if (!item) {
      localStorage.removeItem(activeScheduleItemStorageKey)
      return
    }

    localStorage.setItem(activeScheduleItemStorageKey, JSON.stringify(item))
  }

  const contextValue = useMemo(
    () => ({
      showBreaks,
      setShowBreaks,
      hidePastLessons,
      setHidePastLessons,
      activeScheduleItem,
      setActiveScheduleItem,
    }),
    [activeScheduleItem, hidePastLessons, showBreaks],
  )

  return <UserPreferencesContext.Provider value={contextValue}>{children}</UserPreferencesContext.Provider>
}

function readStoredActiveScheduleItem(): ActiveScheduleItem | null {
  const value = localStorage.getItem(activeScheduleItemStorageKey)
  if (!value) {
    return null
  }

  try {
    const item = JSON.parse(value) as Partial<ActiveScheduleItem>
    if ((item.item_type === 'group' || item.item_type === 'teacher') && typeof item.ruz_id === 'number') {
      return { item_type: item.item_type, ruz_id: item.ruz_id }
    }
  } catch {
    localStorage.removeItem(activeScheduleItemStorageKey)
  }

  return null
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  const value = localStorage.getItem(key)
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return fallback
}
