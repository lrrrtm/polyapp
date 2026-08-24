import { Navigate } from 'react-router'
import { appConfig } from '../app/config'
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
    return <Navigate to={appConfig.VITE_ADMISSIONS_ENABLED ? '/freshman' : '/schedule'} replace />
  }

  return <Navigate to="/schedule" replace />
}
