/**
 * Keyboard movement for the local player (Spec §3.1, §3.3).
 * - WASD / arrows, continuous while held, normalised diagonals.
 * - Per-axis collision against the shared tile grid so players slide on walls.
 * - Position is kept in a ref (60 fps) and synced to the server at 20 Hz.
 * - Server corrections (snap-back) overwrite the ref.
 * - Eliminated players drift as ghosts: no wall collision, map bounds only.
 */
import { useEffect, useRef } from 'react'
import { MATCH_SETTINGS, inMapBounds, isWalkable, normalise, type Direction, type Vec2 } from '@netagiri/shared'
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import { useCurrentPlayer } from 'common/hooks/useCurrentPlayer'
import { MOVE_EMIT_INTERVAL_MS } from 'config/constants'
import { sendMove } from 'slices/game/thunk'

const KEYMAP: Record<string, Direction> = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
}

export function useLocalMovement(paused = false) {
  const dispatch = useAppDispatch()
  const me = useCurrentPlayer()
  const canMove = useAppSelector((s) => s.game.match?.state === 'PLAYING' && !s.game.activeTaskId) && !paused
  const pos = useRef<Vec2 | null>(null)
  const facing = useRef<Direction>('down')
  const held = useRef(new Set<Direction>())

  // Accept authoritative position whenever the server sends one for us.
  useEffect(() => {
    if (me) pos.current = { ...me.position }
  }, [me?.position.x, me?.position.y])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const dir = KEYMAP[e.code]
      if (!dir || (e.target as HTMLElement)?.tagName === 'INPUT') return
      e.preventDefault()
      held.current.add(dir)
    }
    const up = (e: KeyboardEvent) => {
      const dir = KEYMAP[e.code]
      if (dir) held.current.delete(dir)
    }
    const blur = () => held.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useEffect(() => {
    if (!canMove || !me) {
      held.current.clear()
      return
    }
    const ghost = !me.alive
    const free = (q: Vec2) => (ghost ? inMapBounds(q) : isWalkable(q))
    let raf = 0
    let last = performance.now()
    let lastEmit = 0
    let dirty = false

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const p = pos.current
      const h = held.current
      if (p && h.size) {
        const dx = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0)
        const dy = (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0)
        const n = normalise(dx, dy)
        const step = MATCH_SETTINGS.moveSpeed * dt
        const nx = { x: p.x + n.x * step, y: p.y }
        if (n.x && free(nx)) p.x = nx.x
        const ny = { x: p.x, y: p.y + n.y * step }
        if (n.y && free(ny)) p.y = ny.y
        if (dx || dy) {
          facing.current = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
          dirty = true
        }
      }
      if (dirty && p && now - lastEmit >= MOVE_EMIT_INTERVAL_MS) {
        dispatch(sendMove({ position: { x: Math.round(p.x), y: Math.round(p.y) }, facing: facing.current }))
        lastEmit = now
        dirty = false
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [canMove, !!me, me?.alive])

  return { pos, facing }
}
