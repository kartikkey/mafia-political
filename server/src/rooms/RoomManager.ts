/**
 * Room membership and lifecycle — Gameplay Spec §10.2, §11.2.
 * One Match per room code. Host leaves → next connected player becomes host.
 * Empty room → disposed (Spec §9.3 zero-player edge case).
 */
import { MATCH_SETTINGS, SPAWN_POINTS, type LobbyView } from '@netagiri/shared'
import { Match, freshStats, type ServerPlayer } from '../game/Match'
import { makeId, makeRoomCode } from '../utils/ids'

const BOT_NAMES = ['Bot Sharma', 'Bot Iyer', 'Bot Reddy', 'Bot Das', 'Bot Khan', 'Bot Mehta', 'Bot Pillai', 'Bot Gill']

export class RoomManager {
  private rooms = new Map<string, Match>()
  /** socketId → { roomCode, playerId } */
  private sockets = new Map<string, { roomCode: string; playerId: string }>()

  get(roomCode: string) {
    return this.rooms.get(roomCode.toUpperCase())
  }

  bySocket(socketId: string) {
    const ref = this.sockets.get(socketId)
    if (!ref) return null
    const match = this.rooms.get(ref.roomCode)
    const player = match?.players.get(ref.playerId)
    return match && player ? { match, player } : null
  }

  create(socketId: string, name: string, avatar: number) {
    const roomCode = makeRoomCode((c) => this.rooms.has(c))
    const match = new Match(roomCode)
    this.rooms.set(roomCode, match)
    const player = this.addPlayer(match, socketId, name, avatar, true)
    return { match, player }
  }

  join(socketId: string, roomCode: string, name: string, avatar: number): { match: Match; player: ServerPlayer } | string {
    const match = this.get(roomCode)
    if (!match) return 'Room not found'
    if (match.state !== 'WAITING') return 'Match already in progress'
    if (match.connectedPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'Name already taken in this room'
    if (match.connectedPlayers.length >= MATCH_SETTINGS.maxPlayers) {
      // A real player bumps a computer player (only once the join is otherwise valid).
      const bot = match.connectedPlayers.find((p) => p.isBot)
      if (!bot) return 'Room is full'
      this.removeBot(match, bot.id)
    }
    return { match, player: this.addPlayer(match, socketId, name, avatar, false) }
  }

  private addPlayer(match: Match, socketId: string, name: string, avatar: number, isHost: boolean): ServerPlayer {
    const player: ServerPlayer = {
      id: makeId(),
      socketId,
      name,
      avatar,
      isHost,
      connected: true,
      alive: true,
      faction: null,
      position: { ...SPAWN_POINTS[match.players.size % SPAWN_POINTS.length] },
      facing: 'down',
      lastMoveAt: Date.now(),
      lastActionAt: 0,
      lastChatAt: 0,
      eliminationReadyAt: 0,
      openTask: null,
      stats: freshStats(),
    }
    match.players.set(player.id, player)
    this.sockets.set(socketId, { roomCode: match.roomCode, playerId: player.id })
    return player
  }

  /**
   * Remove a socket. In the lobby the player is deleted; mid-match they are
   * marked disconnected so stats/reveal still include them (Spec §12).
   */
  leave(socketId: string): { match: Match; playerId: string; closed: boolean } | null {
    const ref = this.bySocket(socketId)
    this.sockets.delete(socketId)
    if (!ref) return null
    const { match, player } = ref

    if (match.state === 'WAITING') match.players.delete(player.id)
    else match.markDisconnected(player.id)

    if (player.isHost) {
      player.isHost = false
      const next = match.connectedPlayers.find((p) => !p.isBot)
      if (next) next.isHost = true
    }

    // Only computer players left → close the room.
    const closed = match.connectedPlayers.every((p) => p.isBot)
    if (closed) {
      match.dispose()
      this.rooms.delete(match.roomCode)
    }
    return { match, playerId: player.id, closed }
  }

  /** Fill empty seats with computer players up to the minimum needed to start. */
  addBots(match: Match): number {
    let added = 0
    while (match.connectedPlayers.length < MATCH_SETTINGS.minPlayers) {
      const taken = new Set(match.connectedPlayers.map((p) => p.name))
      const name = BOT_NAMES.find((n) => !taken.has(n)) ?? `Bot ${match.players.size + 1}`
      const id = makeId()
      const bot = this.addPlayer(match, `bot:${id}`, name, match.players.size % 8, false)
      bot.isBot = true
      added++
    }
    return added
  }

  removeBot(match: Match, id: string) {
    const p = match.players.get(id)
    if (!p?.isBot) return
    match.players.delete(id)
    this.sockets.delete(p.socketId)
  }

  lobbyView(match: Match): LobbyView {
    return {
      roomCode: match.roomCode,
      hostId: match.hostId ?? '',
      players: match.publicPlayers().filter((p) => p.connected),
      minPlayers: MATCH_SETTINGS.minPlayers,
      maxPlayers: MATCH_SETTINGS.maxPlayers,
    }
  }
}
