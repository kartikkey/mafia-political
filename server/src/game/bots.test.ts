import { afterEach, describe, expect, it, vi } from 'vitest'
import { SPAWN_POINTS, TASK_STATIONS } from '@netagiri/shared'
import { RoomManager } from '../rooms/RoomManager'
import { wireMatch } from './flow'
import { findPath } from './bots'
import { startTicker } from './ticker'
import type { IO } from '../handlers/types'

/** Socket.IO stand-in: records emitted event names. */
function fakeIO() {
  const events: string[] = []
  const chain: any = { to: () => chain, except: () => chain, emit: (e: string) => (events.push(e), true) }
  return { io: chain as IO, events }
}

afterEach(() => vi.useRealTimers())

describe('computer players', () => {
  it('fills a 1-human lobby to the minimum and a human joining bumps a bot', () => {
    const rooms = new RoomManager()
    const { match } = rooms.create('h', 'Host', 0)
    expect(rooms.addBots(match)).toBe(5)
    expect(match.connectedPlayers.filter((p) => p.isBot)).toHaveLength(5)
    for (let i = 0; i < 4; i++) rooms.join(`x${i}`, match.roomCode, `Real${i}`, 1)
    expect(match.connectedPlayers).toHaveLength(10)
    rooms.join('late', match.roomCode, 'Late', 2)
    expect(match.connectedPlayers).toHaveLength(10)
    expect(match.connectedPlayers.filter((p) => p.isBot)).toHaveLength(4)
    match.dispose()
  })

  it('room closes when only bots remain', () => {
    const rooms = new RoomManager()
    const { match } = rooms.create('h', 'Host', 0)
    rooms.addBots(match)
    expect(rooms.leave('h')?.closed).toBe(true)
  })

  it('pathfinding reaches every task station from spawn', () => {
    for (const s of TASK_STATIONS) expect(findPath(SPAWN_POINTS[0], s.position).length).toBeGreaterThan(0)
  })

  it('a bot-filled match plays itself: tasks, meetings, votes and a winner', () => {
    vi.useFakeTimers()
    const rooms = new RoomManager()
    const { io, events } = fakeIO()
    const { match, player } = rooms.create('h', 'Host', 0)
    wireMatch(io, match)
    startTicker(io, match)
    rooms.addBots(match)
    expect(match.start(player.id)).toBeNull()
    // the human idles; bots act. Simulate up to 12 minutes of game time.
    for (let i = 0; i < 3600 && match.state !== 'GAME_OVER'; i++) vi.advanceTimersByTime(200)
    expect(events).toContain('PLAYER_MOVED')
    expect(events).toContain('TASK_PROGRESS')
    expect(match.state).toBe('GAME_OVER')
    expect(match.result).not.toBeNull()
    match.dispose()
  })
})

describe('ghost whispers + replay', () => {
  it('ghost chat reaches only eliminated players; living chat never reaches ghosts', async () => {
    const { actChat } = await import('./actions')
    const rooms = new RoomManager()
    const { match, player } = rooms.create('h', 'Host', 0)
    for (let i = 1; i < 6; i++) rooms.join(`s${i}`, match.roomCode, `MP${i}`, i)
    match.start(player.id)
    match.setState('PLAYING')
    const all = [...match.players.values()]
    const [ghostA, ghostB, alive] = all
    ghostA.alive = false
    ghostB.alive = false
    const sent: { to: string[]; msg: any }[] = []
    const io: any = { to: (to: string[]) => ({ emit: (_e: string, msg: any) => sent.push({ to, msg }) }) }
    expect(actChat(io, match, ghostA, 'boo')).toBeNull()
    expect(sent[0].to.sort()).toEqual([ghostA.socketId, ghostB.socketId].sort())
    expect(sent[0].msg.ghost).toBe(true)
    expect(actChat(io, match, alive, 'hi')).toBe('Chat opens during discussion')
    match.setState('DISCUSSION')
    expect(actChat(io, match, alive, 'hi')).toBeNull()
    expect(sent[1].to).not.toContain(ghostA.socketId)
    match.dispose()
  })

  it('body report carries a replay of living players near the body', () => {
    vi.useFakeTimers()
    const rooms = new RoomManager()
    const { match, player } = rooms.create('h', 'Host', 0)
    for (let i = 1; i < 6; i++) rooms.join(`s${i}`, match.roomCode, `MP${i}`, i)
    match.start(player.id)
    match.setState('PLAYING')
    for (let i = 0; i < 60; i++) {
      vi.advanceTimersByTime(250)
      match.recordFrame()
    }
    const all = [...match.players.values()]
    const killer = all.find((p) => p.faction === 'DEEP_STATE')!
    const victim = all.find((p) => p.faction === 'GOVERNMENT')!
    killer.position = { ...victim.position }
    vi.advanceTimersByTime(300)
    const body = match.eliminate(killer.id, victim.id)
    if (typeof body === 'string') throw new Error(body)
    const reporter = all.find((p) => p.faction === 'GOVERNMENT' && p.id !== victim.id)!
    reporter.position = { ...body.position }
    vi.advanceTimersByTime(300)
    expect(match.report(reporter.id, body.bodyId)).toBeNull()
    const replay = match.meeting!.replay!
    expect(replay.frames.length).toBeGreaterThanOrEqual(36) // ~10s of 250ms test ticks
    expect(replay.bodyPlayerId).toBe(victim.id)
    expect(replay.frames.every((f) => f.players.every((p) => Math.hypot(p.x - body.position.x, p.y - body.position.y) <= replay.radius))).toBe(true)
    match.dispose()
  })
})
