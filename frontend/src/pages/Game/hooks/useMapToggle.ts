/** M toggles the full-map overlay; Esc closes it. UI-only state. */
import { useCallback, useEffect, useState } from 'react'

export function useMapToggle() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.repeat) return
      if (e.key.toUpperCase() === 'M') setOpen((o) => !o)
      else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return { mapOpen: open, toggleMap: useCallback(() => setOpen((o) => !o), []), closeMap: close }
}
