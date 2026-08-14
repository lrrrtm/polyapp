import Skeleton, { type SkeletonProps } from '@mui/material/Skeleton'
import { useEffect, useState } from 'react'

function useDelayedVisible(show: boolean, delay = 250): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!show) {
      setVisible(false)
      return
    }

    const timeoutId = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timeoutId)
  }, [delay, show])

  return visible
}

type DelayedSkeletonProps = SkeletonProps & {
  show: boolean
  delay?: number
}

export function DelayedSkeleton({ show, delay, ...props }: DelayedSkeletonProps) {
  if (!useDelayedVisible(show, delay)) {
    return null
  }

  return <Skeleton animation="wave" {...props} />
}
