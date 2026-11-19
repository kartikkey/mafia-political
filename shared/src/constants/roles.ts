import type { Faction } from '../types/game'

/** Spec §2.1 — total players → [government, deepState]. */
export const ROLE_DISTRIBUTION: Record<number, { government: number; deepState: number }> = {
  6: { government: 4, deepState: 2 },
  7: { government: 5, deepState: 2 },
  8: { government: 6, deepState: 2 },
  9: { government: 6, deepState: 3 },
  10: { government: 7, deepState: 3 },
}

export const FACTION_COPY: Record<Faction, { title: string; objective: string }> = {
  GOVERNMENT: {
    title: 'Government MP',
    objective: 'Complete parliamentary tasks and vote out every Deep State agent.',
  },
  DEEP_STATE: {
    title: 'Deep State Agent',
    objective: 'Sabotage Parliament and eliminate MPs until you equal their numbers.',
  },
}
