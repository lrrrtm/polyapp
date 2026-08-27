import Stack from '@mui/material/Stack'
import { DelayedSkeleton } from './DelayedSkeleton'
import { useDelayedVisible } from './useDelayedVisible'

type ListItemSkeletonProps = {
  show: boolean
  rows?: number
  icon?: boolean
  action?: boolean
  disableGutters?: boolean
}

export function ListItemSkeleton({ show, rows = 2, icon = true, action = false, disableGutters = false }: ListItemSkeletonProps) {
  const visible = useDelayedVisible(show)

  if (!visible) {
    return null
  }

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', px: disableGutters ? 0 : 3, py: 1 }}>
      {icon ? <DelayedSkeleton show={show} delay={0} variant="circular" width={24} height={24} /> : null}
      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <DelayedSkeleton show={show} delay={0} variant="text" width="65%" />
        {rows > 1 ? <DelayedSkeleton show={show} delay={0} variant="text" width="85%" /> : null}
      </Stack>
      {action ? <DelayedSkeleton show={show} delay={0} variant="text" width={24} height={32} /> : null}
    </Stack>
  )
}
