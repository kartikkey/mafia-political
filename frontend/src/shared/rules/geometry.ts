import type { Vec2 } from '../types/game'

export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

export const withinRange = (a: Vec2, b: Vec2, range: number) => distance(a, b) <= range

/** Normalise an input vector so diagonal movement isn't faster (Spec §3.3). */
export function normalise(dx: number, dy: number): Vec2 {
  const len = Math.hypot(dx, dy)
  return len === 0 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len }
}
