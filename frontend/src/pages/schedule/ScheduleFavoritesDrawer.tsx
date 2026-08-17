import AddIcon from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import List from '@mui/material/List'
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
import type { ScheduleItem } from '../../shared/api/users'
import { BottomDrawer } from '../../shared/ui/BottomDrawer'
import { DelayedSkeleton } from '../../shared/ui/DelayedSkeleton'
import { EmptyState } from '../../shared/ui/EmptyState'
import { ListItemSkeleton } from '../../shared/ui/ListItemSkeleton'
import { centeredFixedSurfaceSx } from '../../shared/ui/layout'
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
  onOpen: () => void
  onClose: () => void
  onSearchChange: (value: string) => void
  onActiveScheduleItemChange: (item: ScheduleItem) => void
  onAddFavorite: (result: SearchResult) => void
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
  onOpen,
  onClose,
  onSearchChange,
  onActiveScheduleItemChange,
  onAddFavorite,
}: ScheduleFavoritesDrawerProps) {
  return (
    <>
      <AppBar
        position="absolute"
        color="default"
        elevation={0}
        sx={{ ...centeredFixedSurfaceSx, top: 'auto', bottom: 56, borderTop: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ minHeight: 56 }}>
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

              return (
                <ListItemButton
                  key={`${item.item_type}-${item.ruz_id}`}
                  selected={isSelected}
                  onClick={() => {
                    onActiveScheduleItemChange(item)
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
                        <Typography noWrap>{getScheduleTitle(item, schedule)}</Typography>
                      )
                    }
                    secondary={
                      itemLoading ? (
                        <DelayedSkeleton show variant="text" width="75%" />
                      ) : (
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {getScheduleSubtitle(item, schedule)}
                        </Typography>
                      )
                    }
                  />
                </ListItemButton>
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
              <EmptyState icon={SearchOffIcon} title="Ничего не найдено" sx={{ minHeight: 280 }} />
            ) : null}
          </List>
        </Stack>
      </BottomDrawer>
    </>
  )
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
