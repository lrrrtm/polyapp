export const emptyStateLottieSources = [
  '/animations/group-not-selected.json',
  '/animations/feedback-success.json',
  '/animations/lessons-finished.json',
  '/animations/no-lessons.json',
  '/animations/not-found.json',
  '/animations/start-typing-group.json',
] as const

export function loadLottieSvg() {
  return import('lottie-react').then(({ LottieSvg }) => ({ default: LottieSvg }))
}

let emptyStateLottiesPreload: Promise<unknown> | undefined
const readyLottieSources = new Set<string>()
const readyLottieObjects = new WeakSet<object>()

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

export function preloadEmptyStateLotties() {
  emptyStateLottiesPreload ??= Promise.allSettled([
    loadLottieSvg(),
    ...emptyStateLottieSources.map((src) =>
      fetch(src, { cache: 'force-cache' }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to preload ${src}`)
        }

        markEmptyStateLottieReady(src)
      }),
    ),
  ])

  return emptyStateLottiesPreload
}
