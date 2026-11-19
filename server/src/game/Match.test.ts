import { afterEach, describe, expect, it } from 'vitest'
import { RoomManager } from '../rooms/RoomManager'

const managers: RoomManager[] = []
function lobbyWith(n: number) {
  const rooms = new RoomManager()
  managers.push(rooms)
  const { match, player: host } = rooms.create('s0', 'Host', 0)
  for (let i = 1; i < n; i++) rooms.join(`s${i}`, match.roomCode, `MP${i}`, i % 8)
  return { rooms, match, host }
}

afterEach(() => managers.forEach((m) => m.get('x')?.dispose()))

describe('Match start (Phase 1)', () => {
  it('rejects start below minimum players', () => {
    const { match, host } = lobbyWith(5)
    expect(match.start(host.id)).toMatch(/at least 6/)
  })

  it('rejects non-host start', () => {
    const { match } = lobbyWith(6)
    const other = [...match.players.values()].find((p) => !p.isHost)!
    expect(match.start(other.id)).toMatch(/host/)
  })

  it('assigns roles privately and only deep state see teammates', () => {
    const { match, host } = lobbyWith(9)
    expect(match.start(host.id)).toBeNull()
    expect(match.state).toBe('ROLE_ASSIGNMENT')
    const all = [...match.players.values()]
    const deep = all.filter((p) => p.faction === 'DEEP_STATE')
    expect(deep).toHaveLength(3)
    for (const p of all) {
      const mates = match.teammatesOf(p.id)
      if (p.faction === 'DEEP_STATE') expect(mates.sort()).toEqual(deep.filter((d) => d.id !== p.id).map((d) => d.id).sort())
      else expect(mates).toEqual([])
    }
    // Public view never leaks a living player's faction.
    expect(match.view().players.every((p) => p.revealedFaction === undefined)).toBe(true)
    match.dispose()
  })

  it('reassigns host when host leaves the lobby', () => {
    const { rooms, match } = lobbyWith(3)
    rooms.leave('s0')
    expect(match.hostId).toBeDefined()
    expect(match.players.size).toBe(2)
  })

  it('rejects joins once a match is running', () => {
    const { rooms, match, host } = lobbyWith(6)
    match.start(host.id)
    expect(rooms.join('late', match.roomCode, 'Late', 0)).toBe('Match already in progress')
    match.dispose()
  })
})

describe('movement validation', () => {
  it('rejects teleports and walls, accepts small steps', () => {
    const { match, host } = lobbyWith(6)
    match.start(host.id)
    match.setState('PLAYING')
    const p = match.players.get(host.id)!
    const start = { ...p.position }
    expect(match.move(p.id, { x: start.x + 500, y: start.y }, 'right', p.lastMoveAt + 50)).toBe(false)
    expect(match.move(p.id, { x: 5, y: 5 }, 'left', p.lastMoveAt + 50)).toBe(false) // wall
    expect(match.move(p.id, { x: start.x + 4, y: start.y }, 'right', p.lastMoveAt + 50)).toBe(true)
    match.dispose()
  })
})
