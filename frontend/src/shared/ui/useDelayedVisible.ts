import { useEffect, useState } from 'react'

export function useDelayedVisible(show: boolean, delay = 250): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!show) {
      setVisible(false)
      return
    }

    const timeoutId = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timeoutId)
  }, [delay, show])

  return visible
}
