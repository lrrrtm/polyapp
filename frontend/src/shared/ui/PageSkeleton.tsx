import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import { DelayedSkeleton } from './DelayedSkeleton'

export function PageSkeleton({ show }: { show: boolean }) {
  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <Stack spacing={2}>
        <Box>
          <DelayedSkeleton show={show} variant="text" width="45%" height={48} />
          <DelayedSkeleton show={show} variant="text" width="85%" />
          <DelayedSkeleton show={show} variant="text" width="70%" />
        </Box>
        <DelayedSkeleton show={show} variant="rounded" height={56} />
        <DelayedSkeleton show={show} variant="rounded" width={128} height={42} />
      </Stack>
    </Container>
  )
}
