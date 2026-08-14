import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import type { ReactNode } from 'react'

type AppAutocompleteProps<TOption> = {
  options: TOption[]
  value: TOption | null
  label: string
  loading?: boolean
  disabled?: boolean
  inputValue?: string
  error?: boolean
  helperText?: ReactNode
  noOptionsText?: string
  getOptionLabel: (option: TOption) => string
  isOptionEqualToValue: (option: TOption, value: TOption) => boolean
  onChange: (value: TOption | null) => void
  onInputChange?: (value: string) => void
}

export function AppAutocomplete<TOption>({
  options,
  value,
  label,
  loading,
  disabled,
  inputValue,
  error,
  helperText,
  noOptionsText = 'Ничего не найдено',
  getOptionLabel,
  isOptionEqualToValue,
  onChange,
  onInputChange,
}: AppAutocompleteProps<TOption>) {
  return (
    <Autocomplete<TOption>
      options={options}
      value={value}
      inputValue={inputValue}
      loading={loading}
      disabled={disabled}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      noOptionsText={noOptionsText}
      loadingText="Загрузка..."
      openText="Открыть"
      closeText="Закрыть"
      clearText="Очистить"
      onChange={(_, nextValue) => onChange(nextValue)}
      onInputChange={(_, nextValue) => onInputChange?.(nextValue)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
        />
      )}
    />
  )
}
