import Alert from '@mui/material/Alert'
import Container from '@mui/material/Container'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { getCurrentUser, getSessionStatus } from '../shared/api/users'
import { PageSkeleton } from '../shared/ui/PageSkeleton'

export function RootPage() {
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSessionStatus,
  })
  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    enabled: sessionQuery.data?.hasUser === true,
  })

  if (sessionQuery.isPending) {
    return <PageSkeleton show />
  }

  if (sessionQuery.isError) {
    return (
      <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
        <Alert severity="error">Не удалось проверить сессию.</Alert>
      </Container>
    )
  }

  if (!sessionQuery.data.hasUser) {
    return <Navigate to="/hello" replace />
  }

  if (profileQuery.isPending) {
    return <PageSkeleton show />
  }

  if (profileQuery.isError) {
    return (
      <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
        <Alert severity="error">Не удалось загрузить профиль.</Alert>
      </Container>
    )
  }

  if (!profileQuery.data.primary_group) {
    return <Navigate to="/register" replace />
  }

  return <Navigate to="/schedule" replace />
}
