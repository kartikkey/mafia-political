/**
 * Room membership and lifecycle — Gameplay Spec §10.2, §11.2.
 * One Match per room code. Host leaves → next connected player becomes host.
 * Empty room → disposed (Spec §9.3 zero-player edge case).
 */
import { MATCH_SETTINGS, SPAWN_POINTS, type LobbyView } from '@netagiri/shared'
import { Match, type ServerPlayer } from '../game/Match'
import { makeId, makeRoomCode } from '../utils/ids'

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
    if (match.connectedPlayers.length >= MATCH_SETTINGS.maxPlayers) return 'Room is full'
    if (match.connectedPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'Name already taken in this room'
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
    else player.connected = false

    if (player.isHost) {
      player.isHost = false
      const next = match.connectedPlayers[0]
      if (next) next.isHost = true
    }

    const closed = match.connectedPlayers.length === 0
    if (closed) {
      match.dispose()
      this.rooms.delete(match.roomCode)
    }
    return { match, playerId: player.id, closed }
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
