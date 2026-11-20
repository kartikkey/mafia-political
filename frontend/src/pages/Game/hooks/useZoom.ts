/** Camera zoom (UI-only state). Z cycles levels; ignored while typing. */
import { useCallback, useEffect, useState } from 'react'
import { ZOOM_LEVELS } from 'config/constants'

export function useZoom() {
  const [i, setI] = useState(0)
  const cycle = useCallback(() => setI((n) => (n + 1) % ZOOM_LEVELS.length), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.repeat || e.key.toUpperCase() !== 'Z') return
      cycle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycle])
  return { zoom: ZOOM_LEVELS[i], cycleZoom: cycle }
}
