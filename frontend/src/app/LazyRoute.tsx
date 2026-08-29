import { Suspense, type ComponentType } from 'react'
import { PageSkeleton } from '../shared/ui/PageSkeleton'

export function LazyRoute({ component: Component }: { component: ComponentType }) {
  return (
    <Suspense fallback={<PageSkeleton show />}>
      <Component />
    </Suspense>
  )
}
