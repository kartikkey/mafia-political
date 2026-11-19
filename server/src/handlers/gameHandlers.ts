/**
 * In-match socket handlers. Every handler resolves the player from the socket
 * (never trusts a client-supplied id) and delegates to game/actions.ts.
 */
import { fail, ok, type HandlerContext } from './types'
import { actChat, actCompleteTask, actEliminate, actEmergency, actMove, actOpenTask, actReport, actSabotage, actVote } from '../game/actions'
import { interacting } from '../game/flow'

const done = (ack: (r: ReturnType<typeof fail> | ReturnType<typeof ok<undefined>>) => void, reason: string | null): void =>
  ack(reason ? fail(reason) : ok(undefined))

export function registerGameHandlers({ io, socket, rooms }: HandlerContext) {
  const ref = () => rooms.bySocket(socket.id)

  socket.on('TIME_SYNC', (ack) => ack(ok({ serverNow: Date.now() })))

  socket.on('PLAYER_MOVED', (p) => {
    const r = ref()
    if (!r || !p?.position) return
    if (!actMove(io, r.match, r.player, p.position, p.facing ?? 'down')) {
      // Snap the mover back to the authoritative position.
      socket.emit('PLAYER_MOVED', { playerId: r.player.id, position: r.player.position, facing: r.player.facing })
    }
  })

  socket.on('TASK_OPENED', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    const res = actOpenTask(io, r.match, r.player, String(p?.taskId ?? ''))
    ack(typeof res === 'string' ? fail(res) : ok({ puzzle: res.puzzle }))
  })

  socket.on('TASK_CLOSED', () => {
    const r = ref()
    if (!r || !r.player.openTask) return
    r.match.closeTask(r.player.id)
    interacting(io, r.match, r.player.id, socket.id, null)
  })

  socket.on('TASK_COMPLETED', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    done(ack, actCompleteTask(io, r.match, r.player, String(p?.taskId ?? ''), p?.payload))
  })

  socket.on('PLAYER_ELIMINATE_REQUEST', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    done(ack, actEliminate(io, r.match, r.player, String(p?.targetId ?? '')))
  })

  socket.on('SABOTAGE_REQUEST', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    done(ack, actSabotage(io, r.match, r.player, p?.type, p?.targetTaskId))
  })

  socket.on('BODY_REPORTED', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    done(ack, actReport(io, r.match, r.player, String(p?.bodyId ?? '')))
  })

  socket.on('EMERGENCY_MEETING', (ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    done(ack, actEmergency(io, r.match, r.player))
  })

  socket.on('CHAT_SEND', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    done(ack, actChat(io, r.match, r.player, p?.text))
  })

  socket.on('VOTE_SUBMITTED', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    done(ack, actVote(io, r.match, r.player, String(p?.choice ?? '')))
  })
}
