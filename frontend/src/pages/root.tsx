import { Navigate } from 'react-router'
import { useRequiredUser } from '../shared/api/useRequiredUser'
import { CenteredAlert } from '../shared/ui/CenteredAlert'
import { PageSkeleton } from '../shared/ui/PageSkeleton'

export function RootPage() {
  const user = useRequiredUser()

  if (user.status === 'loading') {
    return <PageSkeleton show />
  }

  if (user.status === 'error') {
    return <CenteredAlert message={user.errorMessage} />
  }

  if (user.status === 'anonymous') {
    return <Navigate to="/hello" replace />
  }

  if (!user.profile.primary_group) {
    return <Navigate to="/freshman" replace />
  }

  return <Navigate to="/schedule" replace />
}
