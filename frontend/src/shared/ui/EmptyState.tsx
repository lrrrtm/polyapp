import type { SvgIconComponent } from '@mui/icons-material'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import type { SxProps, Theme } from '@mui/material/styles'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { waitForBootTask } from '../../app/boot'
import {
  getLoadedEmptyStateLottie,
  isEmptyStateLottieReady,
  loadEmptyStateLottie,
  loadLottieComponent,
  markEmptyStateLottieReady,
} from './empty-state-lotties'

const Lottie = lazy(loadLottieComponent)
const emptyStateLottieSize = 144

type EmptyStateBaseProps = {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  sx?: SxProps<Theme>
}

type EmptyStateVisualProps =
  | {
      icon: SvgIconComponent
      lottieSrc?: never
    }
  | {
      icon?: SvgIconComponent
      lottieSrc: string | object
    }

type EmptyStateProps = EmptyStateBaseProps & EmptyStateVisualProps

export function EmptyState({ icon: Icon, lottieSrc, title, description, actionLabel, onAction, sx }: EmptyStateProps) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  return (
    <Box sx={[{ minHeight: 'calc(100vh - 96px)', display: 'grid', placeItems: 'center', px: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
        {lottieSrc ? (
          <EmptyStateLottie lottieSrc={lottieSrc} reduceMotion={reduceMotion} />
        ) : Icon ? (
          <Icon color="disabled" sx={{ fontSize: 56 }} aria-hidden />
        ) : null}
        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Stack>
        {actionLabel ? (
          <Button variant="contained" size="large" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  )
}

function EmptyStateLottie({ lottieSrc, reduceMotion }: { lottieSrc: string | object; reduceMotion: boolean }) {
  const [ready, setReady] = useState(() => isEmptyStateLottieReady(lottieSrc) && !document.getElementById('boot-splash'))
  const [animationData, setAnimationData] = useState(() => getLoadedEmptyStateLottie(lottieSrc))
  const completeBootTaskRef = useRef<() => void>(() => undefined)

  const handleReady = useCallback(() => {
    markEmptyStateLottieReady(lottieSrc)
    completeBootTaskRef.current()
    completeBootTaskRef.current = () => undefined
    setReady(true)
  }, [lottieSrc])

  useEffect(() => {
    if (ready) {
      return
    }

    completeBootTaskRef.current = waitForBootTask()

    return () => {
      completeBootTaskRef.current()
      completeBootTaskRef.current = () => undefined
    }
  }, [ready])

  useEffect(() => {
    if (typeof lottieSrc !== 'string') {
      setAnimationData(lottieSrc)
      return
    }

    const cached = getLoadedEmptyStateLottie(lottieSrc)
    if (cached) {
      setAnimationData(cached)
      return
    }

    let active = true
    void loadEmptyStateLottie(lottieSrc)
      .then((data) => {
        if (active) {
          setAnimationData(data)
        }
      })
      .catch(() => {
        if (active) {
          handleReady()
        }
      })

    return () => {
      active = false
    }
  }, [handleReady, lottieSrc])

  return (
    <Box sx={{ width: emptyStateLottieSize, height: emptyStateLottieSize, position: 'relative', display: 'grid', placeItems: 'center' }}>
      {ready ? null : <Skeleton variant="rounded" width={emptyStateLottieSize} height={emptyStateLottieSize} sx={{ borderRadius: 4 }} />}
      <Suspense fallback={null}>
        {animationData ? (
          <Lottie
            src={animationData}
            autoplay={!reduceMotion}
            loop={!reduceMotion}
            subscriptions={{ ready: handleReady, error: handleReady }}
            style={{ position: 'absolute', inset: 0, width: emptyStateLottieSize, height: emptyStateLottieSize, opacity: ready ? 1 : 0 }}
            aria-hidden
          />
        ) : null}
      </Suspense>
    </Box>
  )
}
