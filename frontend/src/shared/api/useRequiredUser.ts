import { useQuery } from '@tanstack/react-query'
import { getCurrentUser, getSessionStatus, type UserProfile } from './users'
import { queryKeys } from './queryKeys'

type RequiredUserState =
  | { status: 'loading' }
  | { status: 'error'; errorMessage: string }
  | { status: 'anonymous' }
  | { status: 'ready'; profile: UserProfile }

export function useRequiredUser(): RequiredUserState {
  const sessionQuery = useQuery({
    queryKey: queryKeys.session(),
    queryFn: getSessionStatus,
  })
  const profileQuery = useQuery({
    queryKey: queryKeys.me(),
    queryFn: getCurrentUser,
    enabled: sessionQuery.data?.hasUser === true,
  })

  if (sessionQuery.isPending) {
    return { status: 'loading' }
  }

  if (sessionQuery.isError) {
    return { status: 'error', errorMessage: 'Не удалось проверить сессию.' }
  }

  if (!sessionQuery.data.hasUser) {
    return { status: 'anonymous' }
  }

  if (profileQuery.isPending) {
    return { status: 'loading' }
  }

  if (profileQuery.isError) {
    return { status: 'error', errorMessage: 'Не удалось загрузить профиль.' }
  }

  return { status: 'ready', profile: profileQuery.data }
}
