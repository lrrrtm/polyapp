import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { forwardRef, type PointerEvent, type ReactNode, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { centeredFixedSurfaceSx } from '../../shared/ui/layout'

type SwipeableScheduleViewportProps = {
  disabled?: boolean
  pageKeys: readonly [string, string, string]
  previous: ReactNode
  current: ReactNode
  next: ReactNode
  onDateCommit: (days: -1 | 1) => void
}

export type SwipeableScheduleViewportHandle = {
  animateToDate: (days: -1 | 1, onCommit?: () => void) => boolean
}

type SwipeState = {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastTime: number
  width: number
  dragging: boolean
  vertical: boolean
}

const dragIntentThreshold = 8
const commitDistance = 72
const commitVelocity = 0.55
const settleTransition = { duration: 0.18, ease: [0.2, 0, 0, 1] } as const
const snapBackTransition = { duration: 0.14, ease: [0.2, 0, 0, 1] } as const

export const SwipeableScheduleViewport = forwardRef<SwipeableScheduleViewportHandle, SwipeableScheduleViewportProps>(function SwipeableScheduleViewport(
  {
    disabled = false,
    pageKeys,
    previous,
    current,
    next,
    onDateCommit,
  },
  ref,
) {
  const reduceMotion = useReducedMotion()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const swipeState = useRef<SwipeState | null>(null)
  const animating = useRef(false)
  const x = useMotionValue(0)
  const [width, setWidth] = useState(0)
  const canSwipe = !disabled && !reduceMotion

  const animateToDate = useCallback((days: -1 | 1, pageWidth: number, onCommit?: () => void) => {
    if (animating.current) {
      return
    }

    animating.current = true
    const target = days > 0 ? -pageWidth * 2 : 0

    void animate(x, target, settleTransition).then(() => {
      flushSync(() => {
        if (onCommit) {
          onCommit()
          return
        }

        onDateCommit(days)
      })
      x.set(-pageWidth)
      animating.current = false
    })
  }, [onDateCommit, x])

  useImperativeHandle(ref, () => ({
    animateToDate(days, onCommit) {
      if (disabled || reduceMotion || width <= 0) {
        return false
      }

      animateToDate(days, width, onCommit)
      return true
    },
  }), [animateToDate, disabled, reduceMotion, width])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    function updateWidth() {
      const nextWidth = root?.getBoundingClientRect().width ?? 0
      setWidth(nextWidth)
      if (nextWidth > 0) {
        x.set(-nextWidth)
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(root)

    return () => observer.disconnect()
  }, [x])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!canSwipe || event.pointerType !== 'touch' || width <= 0) {
      swipeState.current = null
      return
    }

    swipeState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      width,
      dragging: false,
      vertical: false,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = swipeState.current
    if (!state || state.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - state.startX
    const deltaY = event.clientY - state.startY

    if (!state.dragging && !state.vertical) {
      if (Math.abs(deltaY) > dragIntentThreshold && Math.abs(deltaY) > Math.abs(deltaX)) {
        state.vertical = true
        return
      }

      if (Math.abs(deltaX) > dragIntentThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
        state.dragging = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    }

    if (!state.dragging) {
      return
    }

    event.preventDefault()
    state.lastX = event.clientX
    state.lastTime = performance.now()
    x.set(-state.width + deltaX)
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const state = swipeState.current
    if (!state || state.pointerId !== event.pointerId) {
      return
    }

    swipeState.current = null

    if (!state.dragging) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const deltaX = event.clientX - state.startX
    const elapsed = Math.max(performance.now() - state.lastTime, 1)
    const velocity = (event.clientX - state.lastX) / elapsed
    const shouldCommit = Math.abs(deltaX) > Math.max(commitDistance, state.width * 0.22) || Math.abs(velocity) > commitVelocity

    if (!shouldCommit) {
      void animate(x, -state.width, snapBackTransition)
      return
    }

    const direction = deltaX < 0 ? 1 : -1
    animateToDate(direction, state.width)
  }

  function handlePointerCancel() {
    const state = swipeState.current
    swipeState.current = null
    if (state?.dragging) {
      void animate(x, -state.width, snapBackTransition)
    }
  }

  return (
    <Container
      ref={rootRef}
      component="main"
      maxWidth={false}
      disableGutters
      sx={{
        ...centeredFixedSurfaceSx,
        position: 'absolute',
        top: 56,
        bottom: 112,
        left: 0,
        right: 0,
        height: 'auto',
        overflow: 'hidden',
        py: 0,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <Box
        component={motion.div}
        style={{ x }}
        sx={{
          display: 'flex',
          width: width > 0 ? width * 3 : '300%',
          height: 1,
          willChange: canSwipe ? 'transform' : undefined,
          backfaceVisibility: 'hidden',
          contain: 'layout paint style',
        }}
      >
        {[previous, current, next].map((content, index) => (
          <Box
            key={pageKeys[index]}
            sx={{
              width: width || '100%',
              height: 1,
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              contain: 'layout paint',
            }}
          >
            {content}
          </Box>
        ))}
      </Box>
    </Container>
  )
})
