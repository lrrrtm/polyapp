import AddIcon from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import PersonIcon from '@mui/icons-material/Person'
import SchoolIcon from '@mui/icons-material/School'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { ScheduleItem } from '../../shared/api/users'
import { BottomDrawer } from '../../shared/ui/BottomDrawer'
import { ConfirmDrawer } from '../../shared/ui/ConfirmDrawer'
import { DelayedSkeleton } from '../../shared/ui/DelayedSkeleton'
import { EmptyState } from '../../shared/ui/EmptyState'
import { ListItemSkeleton } from '../../shared/ui/ListItemSkeleton'
import { appMaxWidth } from '../../shared/ui/layout'
import { getScheduleSubtitle, getScheduleTitle, type Schedule, type SearchResult } from './schedule-utils'

type SchedulePreviewQuery = {
  data?: Schedule
  isPending: boolean
}

type ScheduleFavoritesDrawerProps = {
  open: boolean
  activeScheduleItem: ScheduleItem | null | undefined
  activeScheduleTitle: string
  scheduleItems: ScheduleItem[]
  scheduleItemQueries: SchedulePreviewQuery[]
  scheduleSearch: string
  filteredScheduleItems: ScheduleItem[]
  searchResults: SearchResult[]
  isExternalSearchPending: boolean
  isExternalSearchReady: boolean
  searchError: boolean
  shouldSearchRuz: boolean
  addFavoritePending: boolean
  addFavoriteError: boolean
  deleteFavoritePending: boolean
  deleteFavoriteError: boolean
  onOpen: () => void
  onClose: () => void
  onSearchChange: (value: string) => void
  onActiveScheduleItemChange: (item: ScheduleItem, title: string) => void
  onAddFavorite: (result: SearchResult) => void
  onDeleteFavorite: (item: ScheduleItem) => Promise<void>
}

type DeleteCandidate = {
  item: ScheduleItem
  title: string
}

export function ScheduleFavoritesDrawer({
  open,
  activeScheduleItem,
  activeScheduleTitle,
  scheduleItems,
  scheduleItemQueries,
  scheduleSearch,
  filteredScheduleItems,
  searchResults,
  isExternalSearchPending,
  isExternalSearchReady,
  searchError,
  shouldSearchRuz,
  addFavoritePending,
  addFavoriteError,
  deleteFavoritePending,
  deleteFavoriteError,
  onOpen,
  onClose,
  onSearchChange,
  onActiveScheduleItemChange,
  onAddFavorite,
  onDeleteFavorite,
}: ScheduleFavoritesDrawerProps) {
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  return (
    <>
      <AppBar
        position="absolute"
        color="default"
        elevation={0}
        sx={{ top: 'auto', bottom: 56, left: 0, right: 0, width: '100%', borderTop: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ minHeight: 56, width: 1, maxWidth: appMaxWidth, mx: 'auto' }}>
          <Button
            color="inherit"
            fullWidth
            onClick={onOpen}
            sx={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 32px',
              minWidth: 0,
              py: 0.75,
              textAlign: 'center',
              textTransform: 'none',
            }}
          >
            <Box />
            <Typography variant="body1" noWrap>
              {activeScheduleTitle}
            </Typography>
            <KeyboardArrowUpIcon sx={{ justifySelf: 'end' }} />
          </Button>
        </Toolbar>
      </AppBar>
      <BottomDrawer open={open} onClose={onClose} title="Избранное" height="70vh">
        <Stack sx={{ height: 1 }}>
          <Box sx={{ px: 2, pb: 1 }}>
            <TextField
              fullWidth
              label="Поиск"
              value={scheduleSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Группа или преподаватель"
              size="small"
            />
          </Box>
          <List sx={{ overflowY: 'auto', pb: 2 }}>
            {filteredScheduleItems.map((item) => {
              const index = scheduleItems.findIndex(
                (scheduleItem) => scheduleItem.item_type === item.item_type && scheduleItem.ruz_id === item.ruz_id,
              )
              const schedule = index >= 0 ? scheduleItemQueries[index]?.data : undefined
              const itemLoading = index >= 0 && scheduleItemQueries[index]?.isPending === true
              const isSelected =
                item.item_type === activeScheduleItem?.item_type && item.ruz_id === activeScheduleItem?.ruz_id
              const title = getScheduleTitle(item, schedule)
              const subtitle = getScheduleSubtitle(item, schedule)

              return (
                <ListItem
                  key={`${item.item_type}-${item.ruz_id}`}
                  disablePadding
                  secondaryAction={
                    item.is_primary ? null : (
                      <IconButton
                        edge="end"
                        aria-label="Удалить из избранного"
                        disabled={deleteFavoritePending}
                        onClick={() => {
                          setDeleteCandidate({ item, title })
                          setDeleteConfirmOpen(true)
                        }}
                      >
                        <CloseIcon />
                      </IconButton>
                    )
                  }
                >
                  <ListItemButton
                    selected={isSelected}
                    sx={{ pr: item.is_primary ? 2 : 7 }}
                    onClick={() => {
                      onActiveScheduleItemChange(item, title)
                      onClose()
                    }}
                  >
                    <ListItemIcon>
                      {item.item_type === 'teacher' ? <PersonIcon color="action" /> : <SchoolIcon color="action" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        itemLoading ? (
                          <DelayedSkeleton show variant="text" width="55%" />
                        ) : (
                          <Typography noWrap>{title}</Typography>
                        )
                      }
                      secondary={
                        itemLoading ? (
                          <DelayedSkeleton show variant="text" width="75%" />
                        ) : (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {subtitle}
                          </Typography>
                        )
                      }
                    />
                  </ListItemButton>
                </ListItem>
              )
            })}
            {isExternalSearchPending ? <SearchResultsLoading show /> : null}
            {searchError ? (
              <Box sx={{ px: 2, py: 1 }}>
                <Alert severity="error">Не удалось выполнить поиск.</Alert>
              </Box>
            ) : null}
            {isExternalSearchReady && searchResults.length > 0
              ? searchResults.map((result) => (
                  <ListItemButton
                    key={`${result.itemType}-${result.ruzId}`}
                    sx={{ position: 'relative', pr: 7 }}
                    onClick={() => onAddFavorite(result)}
                  >
                    <ListItemIcon>
                      {result.itemType === 'teacher' ? <PersonIcon color="action" /> : <SchoolIcon color="action" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography noWrap>{result.title}</Typography>}
                      secondary={
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {result.subtitle}
                        </Typography>
                      }
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', position: 'absolute', right: 16 }}>
                      <IconButton
                        aria-label="Добавить в избранное"
                        disabled={addFavoritePending}
                        onClick={(event) => {
                          event.stopPropagation()
                          onAddFavorite(result)
                        }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </ListItemButton>
                ))
              : null}
            {shouldSearchRuz && addFavoriteError ? (
              <Box sx={{ px: 2, py: 1 }}>
                <Alert severity="error">Не удалось добавить в избранное.</Alert>
              </Box>
            ) : null}
            {isExternalSearchReady && filteredScheduleItems.length === 0 && searchResults.length === 0 ? (
              <EmptyState
                icon={SearchOffIcon}
                lottieSrc="/animations/not-found.json"
                title="Ничего не найдено"
                description="Попробуй изменить свой запрос"
                sx={{ minHeight: 280 }}
              />
            ) : null}
          </List>
        </Stack>
      </BottomDrawer>
      <ConfirmDrawer
        open={deleteConfirmOpen}
        title="Удаление из избранного"
        message={getDeleteFavoriteQuestion(deleteCandidate)}
        confirmLabel="Удалить"
        confirmColor="error"
        confirmDisabled={!deleteCandidate}
        confirmLoading={deleteFavoritePending}
        error={deleteFavoriteError ? 'Не удалось удалить из избранного.' : null}
        onClose={() => {
          if (!deleteFavoritePending) {
            setDeleteConfirmOpen(false)
          }
        }}
        onConfirm={() => {
          if (!deleteCandidate) {
            return
          }

          void onDeleteFavorite(deleteCandidate.item)
            .then(() => setDeleteConfirmOpen(false))
            .catch(() => undefined)
        }}
        onExited={() => setDeleteCandidate(null)}
      />
    </>
  )
}

function getDeleteFavoriteQuestion(candidate: DeleteCandidate | null) {
  if (!candidate) {
    return 'Удалить расписание из избранного?'
  }

  const itemLabel = candidate.item.item_type === 'teacher' ? 'преподавателя' : 'группы'
  return `Удалить расписание ${itemLabel} ${candidate.title} из избранного?`
}

function SearchResultsLoading({ show }: { show: boolean }) {
  return (
    <Stack spacing={0.5} sx={{ py: 1 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <ListItemSkeleton key={index} show={show} action />
      ))}
    </Stack>
  )
}
