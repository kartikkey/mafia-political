import { describe, expect, it } from 'vitest'
import { checkVictory } from './victory'
import { tallyVotes } from './voting'
import { assignRoles } from './roles'
import { ROLE_DISTRIBUTION } from '../constants/roles'
import { GRID, SPAWN_POINTS, TASK_STATIONS, isWalkable, roomAt, POWER_PANEL, EMERGENCY_BUTTON } from '../map/parliament'
import { TILE_SIZE } from '../constants/settings'

const p = (faction: 'GOVERNMENT' | 'DEEP_STATE', alive = true, connected = true) => ({ faction, alive, connected })

describe('checkVictory (Spec §9.2)', () => {
  it('government wins at full task progress', () => {
    expect(checkVictory({ players: [p('GOVERNMENT'), p('GOVERNMENT'), p('DEEP_STATE')], completedTasks: 9, totalTasks: 9 })).toBe('GOVERNMENT_WINS')
  })
  it('government wins when no deep state remains', () => {
    expect(checkVictory({ players: [p('GOVERNMENT'), p('DEEP_STATE', false)], completedTasks: 0, totalTasks: 9 })).toBe('GOVERNMENT_WINS')
  })
  it('deep state wins at parity', () => {
    expect(checkVictory({ players: [p('GOVERNMENT'), p('GOVERNMENT', false), p('DEEP_STATE')], completedTasks: 0, totalTasks: 9 })).toBe('DEEP_STATE_WINS')
  })
  it('disconnected players do not count as living', () => {
    expect(checkVictory({ players: [p('GOVERNMENT'), p('GOVERNMENT', true, false), p('GOVERNMENT'), p('DEEP_STATE')], completedTasks: 0, totalTasks: 9 })).toBe('NO_WINNER')
    expect(checkVictory({ players: [p('GOVERNMENT'), p('GOVERNMENT', true, false), p('DEEP_STATE')], completedTasks: 0, totalTasks: 9 })).toBe('DEEP_STATE_WINS')
  })
  it('zero total tasks never awards a task victory', () => {
    expect(checkVictory({ players: [p('GOVERNMENT'), p('GOVERNMENT'), p('GOVERNMENT'), p('DEEP_STATE')], completedTasks: 0, totalTasks: 0 })).toBe('NO_WINNER')
  })
})

describe('tallyVotes (Spec §8.4)', () => {
  it('ejects a strict plurality', () => {
    expect(tallyVotes({ a: 'x', b: 'x', c: 'y' }).ejectedPlayerId).toBe('x')
  })
  it('tie → nobody', () => {
    expect(tallyVotes({ a: 'x', b: 'y' }).ejectedPlayerId).toBeNull()
  })
  it('skip plurality → nobody', () => {
    expect(tallyVotes({ a: 'SKIP', b: 'SKIP', c: 'x' }).ejectedPlayerId).toBeNull()
  })
  it('tie with skip → nobody', () => {
    expect(tallyVotes({ a: 'SKIP', b: 'x' }).ejectedPlayerId).toBeNull()
  })
  it('no votes → nobody', () => {
    expect(tallyVotes({}).ejectedPlayerId).toBeNull()
  })
})

describe('assignRoles (Spec §2.1)', () => {
  for (const [n, dist] of Object.entries(ROLE_DISTRIBUTION)) {
    it(`${n} players → ${dist.deepState} deep state`, () => {
      const ids = Array.from({ length: Number(n) }, (_, i) => `p${i}`)
      const roles = Object.values(assignRoles(ids))
      expect(roles.filter((r) => r === 'DEEP_STATE')).toHaveLength(dist.deepState)
      expect(roles.filter((r) => r === 'GOVERNMENT')).toHaveLength(dist.government)
    })
  }
  it('rejects unsupported counts', () => {
    expect(() => assignRoles(['a', 'b'])).toThrow()
  })
})

describe('parliament map', () => {
  it('has the expected dimensions', () => {
    expect(GRID).toHaveLength(26)
    expect(GRID[0]).toHaveLength(40)
  })
  it('spawn points, stations and interactables are on walkable floor', () => {
    for (const pt of [...SPAWN_POINTS, ...TASK_STATIONS.map((s) => s.position), POWER_PANEL, EMERGENCY_BUTTON]) {
      expect(isWalkable(pt), JSON.stringify(pt)).toBe(true)
    }
  })
  it('every room is reachable from the Lok Sabha spawn', () => {
    const start = [Math.floor(SPAWN_POINTS[0].x / TILE_SIZE), Math.floor(SPAWN_POINTS[0].y / TILE_SIZE)]
    const seen = new Set([start.join(',')])
    const queue = [start]
    while (queue.length) {
      const [x, y] = queue.shift()!
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        const key = `${nx},${ny}`
        if (!seen.has(key) && GRID[ny]?.[nx] === 0) {
          seen.add(key)
          queue.push([nx, ny])
        }
      }
    }
    for (const s of TASK_STATIONS) {
      const key = `${Math.floor(s.position.x / TILE_SIZE)},${Math.floor(s.position.y / TILE_SIZE)}`
      expect(seen.has(key), s.stationId).toBe(true)
      expect(roomAt(s.position)).toBe(s.roomId)
    }
  })
})
