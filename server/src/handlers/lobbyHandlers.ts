/** Lobby + role assignment + disconnects. */
import { broadcastMatch, endVoting, finishIfWon, interacting, wireMatch } from '../game/flow'
import type { Match } from '../game/Match'
import { sanitiseName } from '../utils/ids'
import { startTicker } from '../game/ticker'
import { forgetBots } from '../game/bots'
import { fail, ok, type HandlerContext, type IO } from './types'

const AVATAR_COUNT = 8
const validAvatar = (a: unknown) => (Number.isInteger(a) && (a as number) >= 0 && (a as number) < AVATAR_COUNT ? (a as number) : 0)

export { broadcastMatch }

/** Send each player only their own role; Deep State also gets teammates (Spec §10.4). */
export function sendRoles(io: IO, match: Match) {
  for (const p of match.players.values()) {
    if (!p.faction || !p.connected) continue
    io.to(p.socketId).emit('ROLE_ASSIGNED', { faction: p.faction, teammateIds: match.teammatesOf(p.id) })
  }
}

export function registerLobbyHandlers({ io, socket, rooms }: HandlerContext) {
  const pushLobby = (match: Match) => io.to(match.roomCode).emit('LOBBY_UPDATED', rooms.lobbyView(match))

  socket.on('CREATE_ROOM', (p, ack) => {
    const name = sanitiseName(p?.name)
    if (!name) return ack(fail('Name must be 2–16 letters or numbers'))
    leave()
    const { match, player } = rooms.create(socket.id, name, validAvatar(p.avatar))
    wireMatch(io, match)
    startTicker(io, match)
    socket.join(match.roomCode)
    ack(ok({ roomCode: match.roomCode, playerId: player.id }))
    pushLobby(match)
  })

  socket.on('JOIN_ROOM', (p, ack) => {
    const name = sanitiseName(p?.name)
    if (!name) return ack(fail('Name must be 2–16 letters or numbers'))
    if (typeof p.roomCode !== 'string') return ack(fail('Enter a room code'))
    leave()
    const res = rooms.join(socket.id, p.roomCode.trim(), name, validAvatar(p.avatar))
    if (typeof res === 'string') return ack(fail(res))
    socket.join(res.match.roomCode)
    ack(ok({ roomCode: res.match.roomCode, playerId: res.player.id }))
    io.to(res.match.roomCode).emit('PLAYER_JOINED', res.match.publicPlayers().find((x) => x.id === res.player.id)!)
    pushLobby(res.match)
  })

  socket.on('SET_AVATAR', (p, ack) => {
    const ref = rooms.bySocket(socket.id)
    if (!ref || ref.match.state !== 'WAITING') return ack(fail('Not in a lobby'))
    ref.player.avatar = validAvatar(p?.avatar)
    ack(ok(undefined))
    pushLobby(ref.match)
  })

  socket.on('START_GAME', (ack) => {
    const ref = rooms.bySocket(socket.id)
    if (!ref) return ack(fail('Not in a room'))
    const reason = ref.match.start(ref.player.id)
    if (reason) return ack(fail(reason))
    ack(ok(undefined))
    io.to(ref.match.roomCode).emit('GAME_STARTED', ref.match.view())
    sendRoles(io, ref.match)
  })

  socket.on('ADD_BOTS', (ack) => {
    const ref = rooms.bySocket(socket.id)
    if (!ref || ref.match.state !== 'WAITING') return ack(fail('Not in a lobby'))
    if (!ref.player.isHost) return ack(fail('Only the host can add computer players'))
    if (rooms.addBots(ref.match) === 0) return ack(fail('Lobby already has enough players'))
    ack(ok(undefined))
    pushLobby(ref.match)
  })

  socket.on('REMOVE_BOTS', (ack) => {
    const ref = rooms.bySocket(socket.id)
    if (!ref || ref.match.state !== 'WAITING') return ack(fail('Not in a lobby'))
    if (!ref.player.isHost) return ack(fail('Only the host can remove computer players'))
    for (const p of [...ref.match.players.values()]) if (p.isBot) rooms.removeBot(ref.match, p.id)
    ack(ok(undefined))
    pushLobby(ref.match)
  })

  socket.on('RETURN_TO_LOBBY', (ack) => {
    const ref = rooms.bySocket(socket.id)
    if (!ref) return ack(fail('Not in a room'))
    if (ref.match.state !== 'GAME_OVER') return ack(fail('Match still in progress'))
    if (!ref.player.isHost) return ack(fail('Only the host can reset the room'))
    // Drop players who disconnected during the match.
    for (const [id, pl] of ref.match.players) if (!pl.connected) ref.match.players.delete(id)
    forgetBots(ref.match)
    ref.match.resetToLobby()
    ack(ok(undefined))
    pushLobby(ref.match)
    broadcastMatch(io, ref.match)
  })

  function leave() {
    const res = rooms.leave(socket.id)
    if (!res) return
    socket.leave(res.match.roomCode)
    if (res.closed) return
    const { match } = res
    io.to(match.roomCode).emit('PLAYER_LEFT', { playerId: res.playerId })
    if (match.state === 'WAITING') return pushLobby(match)
    if (match.state === 'PLAYING') interacting(io, match, res.playerId, socket.id, null)
    // Prompt 7: a mid-match disconnect no longer counts → re-check victory.
    if (finishIfWon(io, match)) return
    broadcastMatch(io, match)
    if (match.state === 'VOTING' && match.allVoted()) endVoting(io, match)
  }
  socket.on('LEAVE_ROOM', leave)
  socket.on('disconnect', leave)
}
