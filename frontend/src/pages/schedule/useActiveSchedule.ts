import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { queryKeys } from '../../shared/api/queryKeys'
import type { UserProfile, ScheduleItem } from '../../shared/api/users'
import { getWeekStartDate } from '../../shared/date'
import { dedupeScheduleItems, fetchSchedule, getScheduleTitle } from './schedule-utils'

export function useActiveSchedule(
  profile: UserProfile | null,
  storedActiveScheduleItem: Pick<ScheduleItem, 'item_type' | 'ruz_id'> | null,
  selectedDate: string,
  scheduleDrawerOpen: boolean,
) {
  const scheduleItems = useMemo(
    () => dedupeScheduleItems([profile?.primary_group, ...(profile?.favorites ?? [])]),
    [profile?.favorites, profile?.primary_group],
  )
  const activeScheduleItem =
    scheduleItems.find(
      (item) => item.item_type === storedActiveScheduleItem?.item_type && item.ruz_id === storedActiveScheduleItem.ruz_id,
    ) ?? profile?.primary_group
  const selectedWeekStartDate = useMemo(() => getWeekStartDate(selectedDate), [selectedDate])
  const activeScheduleQuery = useQuery({
    queryKey: activeScheduleItem
      ? queryKeys.schedule(activeScheduleItem.item_type, activeScheduleItem.ruz_id, selectedWeekStartDate)
      : queryKeys.scheduleEmpty(),
    queryFn: () => fetchSchedule(activeScheduleItem as ScheduleItem, selectedWeekStartDate),
    enabled: activeScheduleItem !== undefined && activeScheduleItem !== null,
  })
  const scheduleItemQueries = useQueries({
    queries: scheduleItems.map((item) => ({
      queryKey: queryKeys.schedule(item.item_type, item.ruz_id, selectedWeekStartDate),
      queryFn: () => fetchSchedule(item, selectedWeekStartDate),
      enabled: scheduleDrawerOpen,
    })),
  })

  return {
    scheduleItems,
    activeScheduleItem,
    selectedWeekStartDate,
    activeScheduleQuery,
    scheduleItemQueries,
    activeScheduleTitle: getScheduleTitle(activeScheduleItem, activeScheduleQuery.data),
  }
}
