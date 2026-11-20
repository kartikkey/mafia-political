/** Keyboard shortcuts for contextual actions (Spec §3.1). Ignored while typing or in a task. */
import { useEffect, useRef } from 'react'
import type { Action } from '../components/ActionBar'

export function useGameHotkeys(actions: Action[], blocked: boolean) {
  const latest = useRef({ actions, blocked })
  latest.current = { actions, blocked }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.repeat || latest.current.blocked) return
      const key = e.code === 'Space' ? 'SPACE' : e.key.toUpperCase()
      const action = latest.current.actions.find((a) => a.keys?.includes(key))
      if (!action) return
      e.preventDefault()
      if (!action.disabledReason) action.onClick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
