import Alert from '@mui/material/Alert'
import Container from '@mui/material/Container'

export function CenteredAlert({ message }: { message: string }) {
  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <Alert severity="error">{message}</Alert>
    </Container>
  )
}
