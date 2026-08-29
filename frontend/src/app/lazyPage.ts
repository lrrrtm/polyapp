import { lazy, type ComponentType } from 'react'

export function lazyPage<TModule extends Record<TKey, ComponentType>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })))
}
