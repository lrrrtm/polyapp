import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { setApplicantCode } from '../../shared/api/admissions'
import { queryKeys } from '../../shared/api/queryKeys'
import { setUserProfileApplicantCode, type UserProfile } from '../../shared/api/users'
import { BottomDrawer } from '../../shared/ui/BottomDrawer'

type ApplicantCodeDrawerProps = {
  open: boolean
  currentCode?: string
  onClose: () => void
}

export function ApplicantCodeDrawer({ open, currentCode, onClose }: ApplicantCodeDrawerProps) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const trimmedCode = code.trim()
  const canSaveCode = /^\d+$/.test(trimmedCode)
  const saveMutation = useMutation({
    mutationFn: () => setApplicantCode(trimmedCode),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.applicantCode(), profile)
      queryClient.setQueryData(queryKeys.me(), (currentProfile: UserProfile | undefined) =>
        setUserProfileApplicantCode(currentProfile, profile),
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.admissions() })
      onClose()
    },
  })
  const formatError = trimmedCode.length > 0 && !canSaveCode
  const helperText = formatError ? 'Код должен состоять только из цифр.' : saveMutation.error?.message

  useEffect(() => {
    if (open) {
      setCode(currentCode ?? '')
    }
  }, [currentCode, open])

  return (
    <BottomDrawer open={open} onClose={onClose} title="Уникальный код поступающего">
      <Stack spacing={2.5} sx={{ px: 3, pt: 1, pb: 4 }}>
        <TextField
          value={code}
          inputMode="numeric"
          autoComplete="off"
          fullWidth
          error={formatError || saveMutation.isError}
          helperText={helperText}
          onChange={(event) => {
            saveMutation.reset()
            setCode(event.target.value.replace(/\s/g, ''))
          }}
        />
        <Button
          variant="contained"
          size="large"
          disabled={!canSaveCode || trimmedCode === currentCode}
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          fullWidth
        >
          Сохранить
        </Button>
      </Stack>
    </BottomDrawer>
  )
}
