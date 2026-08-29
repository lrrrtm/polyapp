export const emptyStateLottieSources = [
  '/animations/contract-success.json',
  '/animations/group-not-selected.json',
  '/animations/feedback-success.json',
  '/animations/lessons-finished.json',
  '/animations/no-lessons.json',
  '/animations/not-found.json',
  '/animations/schedule-error.json',
  '/animations/start-typing-group.json',
] as const

export function loadLottieComponent() {
  return import('lottie-react').then(({ Lottie }) => ({ default: Lottie }))
}

let emptyStateLottiesPreload: Promise<unknown> | undefined
const readyLottieSources = new Set<string>()
const readyLottieObjects = new WeakSet<object>()
const lottieDataBySource = new Map<string, object>()

export function isEmptyStateLottieReady(src: string | object) {
  return typeof src === 'string' ? readyLottieSources.has(src) : readyLottieObjects.has(src)
}

export function markEmptyStateLottieReady(src: string | object) {
  if (typeof src === 'string') {
    readyLottieSources.add(src)
    return
  }

  readyLottieObjects.add(src)
}

export function getLoadedEmptyStateLottie(src: string | object) {
  return typeof src === 'string' ? lottieDataBySource.get(src) : src
}

export async function loadEmptyStateLottie(src: string) {
  const cached = lottieDataBySource.get(src)
  if (cached) {
    return cached
  }

  const response = await fetch(src, { cache: 'force-cache' })
  if (!response.ok) {
    throw new Error(`Failed to load ${src}`)
  }

  const data = (await response.json()) as object
  lottieDataBySource.set(src, data)
  markEmptyStateLottieReady(src)
  return data
}

export function preloadEmptyStateLotties() {
  emptyStateLottiesPreload ??= Promise.allSettled([
    loadLottieComponent(),
    ...emptyStateLottieSources.map(loadEmptyStateLottie),
  ])

  return emptyStateLottiesPreload
}
