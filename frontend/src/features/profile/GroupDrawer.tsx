import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { type Group, searchGroups } from '../../shared/api/ruz'
import { queryKeys } from '../../shared/api/queryKeys'
import { setPrimaryGroup } from '../../shared/api/users'
import { AppAutocomplete } from '../../shared/ui/AppAutocomplete'
import { BottomDrawer } from '../../shared/ui/BottomDrawer'

type GroupDrawerProps = {
  open: boolean
  currentGroup: Group | null
  primaryGroupId?: number
  loading?: boolean
  error?: boolean
  onClose: () => void
  onSaved?: (group: Group) => void
}

export function GroupDrawer({ open, currentGroup, primaryGroupId, loading, error, onClose, onSaved }: GroupDrawerProps) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingGroup, setPendingGroup] = useState<Group | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchQuery = useQuery({
    queryKey: queryKeys.groupsSearch(debouncedSearch),
    queryFn: () => searchGroups(debouncedSearch),
    enabled: open && debouncedSearch.length > 0,
  })
  const groupOptions = useMemo(
    () => dedupeGroups([currentGroup, ...(searchQuery.data ?? [])]),
    [currentGroup, searchQuery.data],
  )
  const saveMutation = useMutation({
    mutationFn: () => setPrimaryGroup(pendingGroup?.id ?? 0),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.me(), profile)
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleRoot() })
      if (pendingGroup) {
        onSaved?.(pendingGroup)
      }
      setConfirmOpen(false)
      setPendingGroup(null)
      onClose()
    },
  })

  useEffect(() => {
    if (open && !confirmOpen) {
      setSearch(currentGroup?.name ?? '')
      setDebouncedSearch('')
    }
  }, [confirmOpen, currentGroup?.name, open])

  useEffect(() => {
    const trimmedSearch = search.trim()
    if (!trimmedSearch || trimmedSearch === currentGroup?.name) {
      setDebouncedSearch('')
      return
    }

    const timeoutId = window.setTimeout(() => setDebouncedSearch(trimmedSearch), 350)
    return () => window.clearTimeout(timeoutId)
  }, [currentGroup?.name, search])

  return (
    <>
      <BottomDrawer open={open} onClose={onClose} title="Учебная группа">
        <Stack spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }}>
          <AppAutocomplete
            options={groupOptions}
            value={currentGroup}
            label="Учебная группа"
            inputValue={search}
            loading={searchQuery.isFetching || loading}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText="Группы не найдены"
            error={searchQuery.isError || error}
            helperText={searchQuery.isError ? 'Не удалось найти группы.' : undefined}
            onChange={(value) => {
              if (!value || value.id === primaryGroupId) {
                return
              }

              setPendingGroup(value)
              onClose()
              setConfirmOpen(true)
            }}
            onInputChange={setSearch}
          />
        </Stack>
      </BottomDrawer>
      <BottomDrawer
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setSearch(currentGroup?.name ?? '')
        }}
        onExited={() => setPendingGroup(null)}
        title="Изменить группу?"
      >
        <Stack spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }}>
          <Stack spacing={0.75}>
            <Typography variant="body1">Сохранить новую учебную группу?</Typography>
            <Typography variant="body2" color="text.secondary">
              {pendingGroup?.name}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" size="large" disabled={saveMutation.isPending} onClick={() => setConfirmOpen(false)} fullWidth>
              Отмена
            </Button>
            <Button
              variant="contained"
              size="large"
              disabled={!pendingGroup || pendingGroup.id === primaryGroupId}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              fullWidth
            >
              Сохранить
            </Button>
          </Stack>
          {saveMutation.isError ? <Alert severity="error">Не удалось сохранить группу. Попробуй ещё раз.</Alert> : null}
        </Stack>
      </BottomDrawer>
    </>
  )
}

function dedupeGroups(groups: Array<Group | null | undefined>): Group[] {
  const seen = new Set<number>()
  return groups.filter((group): group is Group => {
    if (!group || seen.has(group.id)) {
      return false
    }

    seen.add(group.id)
    return true
  })
}
