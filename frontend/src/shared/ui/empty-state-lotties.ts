export const emptyStateLottieSources = [
  '/animations/group-not-selected.json',
  '/animations/lessons-finished.json',
  '/animations/no-lessons.json',
  '/animations/not-found.json',
] as const

export function loadLottieSvg() {
  return import('lottie-react').then(({ LottieSvg }) => ({ default: LottieSvg }))
}

let emptyStateLottiesPreload: Promise<unknown> | undefined

export function preloadEmptyStateLotties() {
  emptyStateLottiesPreload ??= Promise.allSettled([
    loadLottieSvg(),
    ...emptyStateLottieSources.map((src) =>
      fetch(src, { cache: 'force-cache' }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to preload ${src}`)
        }
      }),
    ),
  ])

  return emptyStateLottiesPreload
}
