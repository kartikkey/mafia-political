import { describe, expect, it } from 'vitest'
import { computeBadges } from './badges'
import type { PlayerMatchStats } from '../types/game'

const s = (playerId: string, faction: PlayerMatchStats['faction'], o: Partial<PlayerMatchStats> = {}): PlayerMatchStats => ({
  playerId, faction, tasksCompleted: 0, eliminations: 0, meetingsAttended: 0, alive: true, ...o,
})

describe('computeBadges', () => {
  it('awards top scorers, shares ties, skips zero scores and ejected bluffers', () => {
    const b = computeBadges([
      s('g1', 'GOVERNMENT', { tasksCompleted: 3, votesOnAgents: 2 }),
      s('g2', 'GOVERNMENT', { tasksCompleted: 3, alive: false, reports: 1 }),
      s('d1', 'DEEP_STATE', { fakeTasks: 4, ejected: true, alive: false, eliminations: 1 }),
      s('d2', 'DEEP_STATE', { fakeTasks: 1, eliminations: 1, powerRepairs: 0 }),
    ])
    const has = (p: string, id: string) => b.some((x) => x.playerId === p && x.badge === id)
    expect(has('g1', 'BILL_PASSER') && has('g2', 'BILL_PASSER')).toBe(true)
    expect(has('d2', 'MASTER_BLUFFER') && !has('d1', 'MASTER_BLUFFER')).toBe(true)
    expect(has('d1', 'SILENT_ASSASSIN') && has('d2', 'SILENT_ASSASSIN')).toBe(true)
    expect(has('g1', 'SHARP_EYE') && has('g2', 'FIRST_RESPONDER')).toBe(true)
    expect(has('g1', 'SURVIVOR') && !has('g2', 'SURVIVOR') && !has('d2', 'SURVIVOR')).toBe(true)
    expect(b.some((x) => x.badge === 'POWER_BROKER')).toBe(false)
  })
})
