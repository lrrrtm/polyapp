import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import type { IconButtonProps } from '@mui/material/IconButton'
import { useEffect, useState } from 'react'

type CopyToClipboardButtonProps = Omit<IconButtonProps, 'onClick'> & {
  value: string
  copiedDelay?: number
}

export function CopyToClipboardButton({ value, copiedDelay = 1500, ...props }: CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }

    const timeout = window.setTimeout(() => setCopied(false), copiedDelay)

    return () => window.clearTimeout(timeout)
  }, [copied, copiedDelay])

  async function handleClick() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
  }

  return (
    <Tooltip title={copied ? 'Скопировано' : 'Скопировать'}>
      <IconButton aria-label={copied ? 'Скопировано' : 'Скопировать'} size="small" onClick={handleClick} {...props}>
        {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  )
}
