import { ROLE_DISTRIBUTION } from '../constants/roles'
import type { Faction } from '../types/game'

/** Fisher–Yates with an injectable RNG so tests are deterministic. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Spec §2.1 — random faction assignment. Throws on an unsupported count. */
export function assignRoles(playerIds: readonly string[], rng: () => number = Math.random): Record<string, Faction> {
  const dist = ROLE_DISTRIBUTION[playerIds.length]
  if (!dist) throw new Error(`Unsupported player count: ${playerIds.length}`)
  const shuffled = shuffle(playerIds, rng)
  const roles: Record<string, Faction> = {}
  shuffled.forEach((id, i) => {
    roles[id] = i < dist.deepState ? 'DEEP_STATE' : 'GOVERNMENT'
  })
  return roles
}
