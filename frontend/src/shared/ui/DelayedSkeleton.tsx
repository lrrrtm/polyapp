import Skeleton, { type SkeletonProps } from '@mui/material/Skeleton'
import { useDelayedVisible } from './useDelayedVisible'

type DelayedSkeletonProps = SkeletonProps & {
  show: boolean
  delay?: number
}

export function DelayedSkeleton({ show, delay, ...props }: DelayedSkeletonProps) {
  const delayedVisible = useDelayedVisible(show, delay)
  const visible = delay === 0 ? show : delayedVisible

  if (!visible) {
    return null
  }

  return <Skeleton animation="wave" {...props} />
}
