import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { type Group, searchGroups } from '../../shared/api/ruz'
import { queryKeys } from '../../shared/api/queryKeys'
import { setPrimaryGroup } from '../../shared/api/users'
import { BottomDrawer, BottomDrawerContent, BottomDrawerList, BottomDrawerSearch } from '../../shared/ui/BottomDrawer'
import { ConfirmDrawer } from '../../shared/ui/ConfirmDrawer'
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
  const [searchOpen, setSearchOpen] = useState(false)
  const showSearch = searchOpen || !currentGroup

  useEffect(() => {
    if (!open) {
      setSearchOpen(false)
    }
  }, [open])

  return (
    <>
      <BottomDrawer open={open && !showSearch} onClose={onClose} title="Основная группа">
        <BottomDrawerContent spacing={3}>
          <Stack spacing={1}>
            {loading ? (
              <ListItemSkeleton show rows={1} disableGutters />
            ) : currentGroup ? (
              <List disablePadding>
                <GroupListItem group={currentGroup} />
              </List>
            ) : (
              <Typography variant="body1">Группа не выбрана</Typography>
            )}
            {error ? <Alert severity="error">Не удалось загрузить текущую группу.</Alert> : null}
          </Stack>
          <Button variant="contained" size="large" onClick={() => setSearchOpen(true)}>
            {currentGroup ? 'Изменить группу' : 'Выбрать группу'}
          </Button>
        </BottomDrawerContent>
      </BottomDrawer>
      <GroupSearchDrawer
        open={open && showSearch}
        currentGroup={currentGroup}
        primaryGroupId={primaryGroupId}
        error={error}
        onBack={onClose}
        onClose={onClose}
        onSaved={onSaved}
      />
    </>
  )
}

function GroupSearchDrawer({ open, primaryGroupId, error, onBack, onClose, onSaved }: GroupDrawerProps & { onBack: () => void }) {
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
    () => dedupeGroups(searchQuery.data ?? []).filter((group) => group.id !== primaryGroupId),
    [primaryGroupId, searchQuery.data],
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
      onBack()
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
  const showStartTyping = !search.trim()

  return (
    <>
      <BottomDrawer open={open} onClose={onBack} title="Выбор группы" height="90dvh" maxHeight="90dvh">
        <Stack sx={{ height: 1 }}>
          <BottomDrawerSearch>
            <TextField
              fullWidth
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Номер группы"
              error={searchQuery.isError || error}
              helperText={searchQuery.isError ? 'Не удалось найти группы.' : undefined}
              slotProps={{ htmlInput: { 'aria-label': 'Поиск группы' } }}
            />
          </BottomDrawerSearch>
          <BottomDrawerList>
            {showStartTyping ? (
              <EmptyState lottieSrc="/animations/start-typing-group.json" title="Начни вводить номер группы" sx={{ minHeight: 280 }} />
            ) : null}
            {searchQuery.isFetching ? <GroupResultsLoading show /> : null}
            {searchReady
              ? groupOptions.map((group) => (
                  <GroupListItem
                    key={group.id}
                    group={group}
                    onClick={() => {
                      setPendingGroup(group)
                      onBack()
                      setConfirmOpen(true)
                    }}
                  />
                ))
              : null}
            {showEmpty ? (
              <EmptyState
                icon={SearchOffIcon}
                lottieSrc="/animations/not-found.json"
                title="Ничего не найдено"
                description="Попробуй изменить свой запрос"
                sx={{ minHeight: 280 }}
              />
            ) : null}
            {searchQuery.isError ? (
              <Box sx={{ px: 3, py: 1 }}>
                <Alert severity="error">Не удалось выполнить поиск.</Alert>
              </Box>
            ) : null}
          </BottomDrawerList>
        </Stack>
      </BottomDrawer>
      <ConfirmDrawer
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
        }}
        onExited={() => {
          setPendingGroup(null)
          setSearch('')
        }}
        title="Изменение группы"
        message={`Изменить основную группу на ${pendingGroup?.name ?? ''}?`}
        confirmLabel="Изменить"
        confirmDisabled={!pendingGroup || pendingGroup.id === primaryGroupId}
        confirmLoading={saveMutation.isPending}
        error={saveMutation.isError ? 'Не удалось сохранить группу. Попробуй ещё раз.' : null}
        onConfirm={() => saveMutation.mutate()}
      />
    </>
  )
}

function GroupListItem({ group, selected = false, onClick }: { group: Group; selected?: boolean; onClick?: () => void }) {
  const content = (
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
  )

  if (!onClick) {
    return <ListItem disableGutters>{content}</ListItem>
  }

  return (
    <ListItemButton selected={selected} onClick={onClick}>
      {content}
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
