import Alert from '@mui/material/Alert'
import Container from '@mui/material/Container'
import { EmptyState } from './EmptyState'

const sessionErrorMessage = 'Не удалось проверить сессию.'
const sessionErrorTitle = 'Не удалось проверить сессию'
const notFoundLottieSrc = '/animations/not-found.json'

export function CenteredAlert({ message }: { message: string }) {
  if (message === sessionErrorMessage) {
    return <EmptyState lottieSrc={notFoundLottieSrc} title={sessionErrorTitle} actionLabel="Обновить" onAction={() => window.location.reload()} />
  }

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <Alert severity="error">{message}</Alert>
    </Container>
  )
}
