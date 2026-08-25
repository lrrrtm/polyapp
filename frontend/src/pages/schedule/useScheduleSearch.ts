import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { queryKeys } from '../../shared/api/queryKeys'
import { searchGroups, searchTeachers } from '../../shared/api/ruz'
import { addFavorite, deleteFavorite, type ScheduleItem } from '../../shared/api/users'
import {
  getScheduleTitle,
  groupToSearchResult,
  isScheduleItemSaved,
  type Schedule,
  type SearchResult,
  teacherToSearchResult,
} from './schedule-utils'

type SchedulePreviewQuery = {
  data?: Schedule
  isPending: boolean
}

export function useScheduleSearch(
  scheduleDrawerOpen: boolean,
  scheduleItems: ScheduleItem[],
  scheduleItemQueries: SchedulePreviewQuery[],
  onFavoriteDeleted?: (item: ScheduleItem) => void,
) {
  const queryClient = useQueryClient()
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [debouncedScheduleSearch, setDebouncedScheduleSearch] = useState('')
  const filteredScheduleItems = useMemo(
    () =>
      scheduleItems.filter((item, index) => {
        const query = scheduleSearch.trim().toLowerCase()
        if (!query) {
          return true
        }

        const schedule = scheduleItemQueries[index]?.data
        return getScheduleTitle(item, schedule).toLowerCase().includes(query)
      }),
    [scheduleItemQueries, scheduleItems, scheduleSearch],
  )
  const trimmedScheduleSearch = scheduleSearch.trim()

  useEffect(() => {
    if (!trimmedScheduleSearch) {
      setDebouncedScheduleSearch('')
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedScheduleSearch(trimmedScheduleSearch)
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [trimmedScheduleSearch])

  const favoriteSearchQuery = debouncedScheduleSearch
  const isSearchSettled = trimmedScheduleSearch === favoriteSearchQuery
  const hasFavoriteSearchQuery = favoriteSearchQuery.length > 0
  const shouldSearchRuz = scheduleDrawerOpen && hasFavoriteSearchQuery
  const groupSearchQuery = useQuery({
    queryKey: queryKeys.groupsSearch(favoriteSearchQuery),
    queryFn: () => searchGroups(favoriteSearchQuery),
    enabled: shouldSearchRuz,
  })
  const teacherSearchQuery = useQuery({
    queryKey: queryKeys.teachersSearch(favoriteSearchQuery),
    queryFn: () => searchTeachers(favoriteSearchQuery),
    enabled: shouldSearchRuz,
  })
  const searchResults = useMemo(
    () =>
      [
        ...(groupSearchQuery.data ?? []).map(groupToSearchResult),
        ...(teacherSearchQuery.data ?? []).map(teacherToSearchResult),
      ].filter((result) => !isScheduleItemSaved(scheduleItems, result.itemType, result.ruzId)),
    [groupSearchQuery.data, scheduleItems, teacherSearchQuery.data],
  )
  const addFavoriteMutation = useMutation({
    mutationFn: (result: SearchResult) => addFavorite(result.itemType, result.ruzId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      setScheduleSearch('')
      setDebouncedScheduleSearch('')
    },
  })
  const deleteFavoriteMutation = useMutation({
    mutationFn: (item: ScheduleItem) => deleteFavorite(item.id),
    onSuccess: async (_, item) => {
      onFavoriteDeleted?.(item)
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    },
  })

  return {
    scheduleSearch,
    setScheduleSearch,
    filteredScheduleItems,
    searchResults,
    isExternalSearchPending:
      shouldSearchRuz && (!isSearchSettled || groupSearchQuery.isPending || teacherSearchQuery.isPending),
    isExternalSearchReady:
      hasFavoriteSearchQuery &&
      isSearchSettled &&
      !groupSearchQuery.isPending &&
      !teacherSearchQuery.isPending &&
      !groupSearchQuery.isError &&
      !teacherSearchQuery.isError,
    searchError: shouldSearchRuz && isSearchSettled && (groupSearchQuery.isError || teacherSearchQuery.isError),
    shouldSearchRuz,
    addFavoriteMutation,
    deleteFavoriteMutation,
  }
}
