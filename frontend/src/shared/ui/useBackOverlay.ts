import { useCallback, useEffect, useRef } from 'react'

type OverlayEntry = {
  id: number
  close: () => void
}

let nextOverlayId = 1
let overlays: OverlayEntry[] = []
let hasHistoryEntry = false
let suppressNextPop = false
let reconcileTimer: number | undefined

function ensurePopstateListener() {
  window.removeEventListener('popstate', handlePopstate)
  window.addEventListener('popstate', handlePopstate)
}

function pushHistoryEntry() {
  const state = typeof window.history.state === 'object' && window.history.state !== null ? window.history.state : {}
  window.history.pushState({ ...state, polytechOverlay: true }, '', window.location.href)
  hasHistoryEntry = true
}

function scheduleHistoryReconcile() {
  window.clearTimeout(reconcileTimer)
  reconcileTimer = window.setTimeout(() => {
    if (overlays.length > 0 && !hasHistoryEntry) {
      pushHistoryEntry()
      return
    }

    if (overlays.length === 0 && hasHistoryEntry) {
      suppressNextPop = true
      hasHistoryEntry = false
      window.history.back()
    }
  })
}

function handlePopstate() {
  if (suppressNextPop) {
    suppressNextPop = false
    return
  }

  hasHistoryEntry = false
  overlays.at(-1)?.close()
  scheduleHistoryReconcile()
}

function registerOverlay(entry: OverlayEntry) {
  ensurePopstateListener()
  overlays = [...overlays, entry]

  if (!hasHistoryEntry) {
    pushHistoryEntry()
  }
}

function unregisterOverlay(id: number) {
  overlays = overlays.filter((entry) => entry.id !== id)
  scheduleHistoryReconcile()
}

function closeTopOverlay() {
  overlays.at(-1)?.close()
}

function isTopOverlay(id: number) {
  return overlays.at(-1)?.id === id
}

export function useBackOverlay(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  const overlayIdRef = useRef<number | null>(null)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    const id = nextOverlayId
    nextOverlayId += 1
    overlayIdRef.current = id
    registerOverlay({ id, close: () => closeRef.current() })

    return () => {
      unregisterOverlay(id)
      if (overlayIdRef.current === id) {
        overlayIdRef.current = null
      }
    }
  }, [open])

  return useCallback(() => {
    const id = overlayIdRef.current
    if (id !== null && isTopOverlay(id)) {
      closeTopOverlay()
      return
    }

    onClose()
  }, [onClose])
}
