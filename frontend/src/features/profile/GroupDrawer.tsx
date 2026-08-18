import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import SchoolIcon from '@mui/icons-material/School'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { type Group, searchGroups } from '../../shared/api/ruz'
import { queryKeys } from '../../shared/api/queryKeys'
import { setPrimaryGroup } from '../../shared/api/users'
import { ActionButton } from '../../shared/ui/ActionButton'
import { BottomDrawer } from '../../shared/ui/BottomDrawer'
import { EmptyState } from '../../shared/ui/EmptyState'
import { ListItemSkeleton } from '../../shared/ui/ListItemSkeleton'

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
      setSearch('')
      setDebouncedSearch('')
    }
  }, [confirmOpen, open])

  useEffect(() => {
    const trimmedSearch = search.trim()
    if (!trimmedSearch) {
      setDebouncedSearch('')
      return
    }

    const timeoutId = window.setTimeout(() => setDebouncedSearch(trimmedSearch), 350)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  const searchReady = debouncedSearch.length > 0 && !searchQuery.isFetching && !searchQuery.isError
  const showEmpty = searchReady && groupOptions.length === 0
  const showCurrentHint = !search.trim() && currentGroup

  return (
    <>
      <BottomDrawer open={open} onClose={onClose} title="Учебная группа" height="70vh">
        <Stack sx={{ height: 1 }}>
          <Box sx={{ px: 2, pb: 1 }}>
            <TextField
              fullWidth
              autoFocus
              label="Поиск"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Номер группы"
              size="small"
              error={searchQuery.isError || error}
              helperText={searchQuery.isError ? 'Не удалось найти группы.' : undefined}
            />
          </Box>
          <List sx={{ overflowY: 'auto', pb: 2 }}>
            {loading ? <ListItemSkeleton show rows={1} /> : null}
            {showCurrentHint ? <GroupListItem group={currentGroup} selected onClick={() => undefined} /> : null}
            {searchQuery.isFetching ? <GroupResultsLoading show /> : null}
            {searchReady
              ? groupOptions.map((group) => (
                  <GroupListItem
                    key={group.id}
                    group={group}
                    selected={group.id === primaryGroupId}
                    onClick={() => {
                      if (group.id === primaryGroupId) {
                        return
                      }

                      setPendingGroup(group)
                      onClose()
                      setConfirmOpen(true)
                    }}
                  />
                ))
              : null}
            {showEmpty ? <EmptyState icon={SearchOffIcon} title="Ничего не найдено" sx={{ minHeight: 280 }} /> : null}
            {searchQuery.isError ? (
              <Box sx={{ px: 2, py: 1 }}>
                <Alert severity="error">Не удалось выполнить поиск.</Alert>
              </Box>
            ) : null}
          </List>
        </Stack>
      </BottomDrawer>
      <BottomDrawer
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setSearch('')
        }}
        onExited={() => setPendingGroup(null)}
        title="Изменение группы"
      >
        <Stack spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }}>
          <Typography variant="body1">Изменить учебную группу на {pendingGroup?.name}?</Typography>
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" size="large" disabled={saveMutation.isPending} onClick={() => setConfirmOpen(false)} fullWidth>
              Отмена
            </Button>
            <ActionButton
              disabled={!pendingGroup || pendingGroup.id === primaryGroupId}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Сохранить
            </ActionButton>
          </Stack>
          {saveMutation.isError ? <Alert severity="error">Не удалось сохранить группу. Попробуй ещё раз.</Alert> : null}
        </Stack>
      </BottomDrawer>
    </>
  )
}

function GroupListItem({ group, selected, onClick }: { group: Group; selected: boolean; onClick: () => void }) {
  return (
    <ListItemButton selected={selected} onClick={onClick}>
      <ListItemIcon>
        <SchoolIcon color="action" />
      </ListItemIcon>
      <ListItemText
        primary={<Typography noWrap>{group.name}</Typography>}
        secondary={
          group.faculty?.name ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {group.faculty.name}
            </Typography>
          ) : null
        }
      />
    </ListItemButton>
  )
}

function GroupResultsLoading({ show }: { show: boolean }) {
  return (
    <Stack spacing={0.5} sx={{ py: 1 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <ListItemSkeleton key={index} show={show} />
      ))}
    </Stack>
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
