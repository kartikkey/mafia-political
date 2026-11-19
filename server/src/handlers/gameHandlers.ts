/**
 * In-match actions. Every handler resolves the player from the socket (never
 * trusts a client-supplied id), delegates validation to Match, then broadcasts.
 */
import { MATCH_SETTINGS } from '@netagiri/shared'
import { announceMeeting, broadcastMatch, endVoting, finishIfWon, interacting, livingSocketIds, news, sendCooldowns } from '../game/flow'
import { fail, ok, type HandlerContext } from './types'

const sanitiseChat = (raw: unknown) =>
  typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MATCH_SETTINGS.chatMaxLength) : ''

let chatSeq = 0

export function registerGameHandlers({ io, socket, rooms }: HandlerContext) {
  const ref = () => rooms.bySocket(socket.id)

  socket.on('PLAYER_MOVED', (p) => {
    const r = ref()
    if (!r || !p?.position) return
    const accepted = r.match.move(r.player.id, p.position, p.facing ?? 'down')
    if (accepted) {
      socket.to(r.match.roomCode).emit('PLAYER_MOVED', { playerId: r.player.id, position: p.position, facing: r.player.facing })
    } else {
      // Snap the mover back to the authoritative position.
      socket.emit('PLAYER_MOVED', { playerId: r.player.id, position: r.player.position, facing: r.player.facing })
    }
  })

  // Prompt 3/4 — tasks & mini-games
  socket.on('TASK_OPENED', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    const res = r.match.openTask(r.player.id, String(p?.taskId ?? ''))
    if (typeof res === 'string') return ack(fail(res))
    ack(ok({ puzzle: res.puzzle }))
    interacting(io, r.match, r.player.id, socket.id, String(p.taskId))
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
    const { match } = r
    const res = match.completeTask(r.player.id, String(p?.taskId ?? ''), p?.payload)
    if (!r.player.openTask) interacting(io, match, r.player.id, socket.id, null)
    if (typeof res === 'string') return ack(fail(res))
    ack(ok(undefined))
    if (res.restored) {
      news(io, match, 'POWER_RESTORED')
      broadcastMatch(io, match)
    }
    if (res.progressed) {
      io.to(match.roomCode).emit('TASK_PROGRESS', { taskId: p.taskId, completedTasks: match.completedTasks, totalTasks: match.tasks.length })
      finishIfWon(io, match)
    }
  })

  // Prompt 5 — Deep State actions
  socket.on('PLAYER_ELIMINATE_REQUEST', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    const { match } = r
    const victim = match.players.get(String(p?.targetId ?? ''))
    const wasWorking = !!victim?.openTask
    const body = match.eliminate(r.player.id, String(p?.targetId ?? ''))
    if (typeof body === 'string') return ack(fail(body))
    ack(ok(undefined))
    if (wasWorking && victim) interacting(io, match, victim.id, victim.socketId, null)
    io.to(match.roomCode).emit('PLAYER_ELIMINATED', { body, livingCount: match.livingPlayers.length })
    sendCooldowns(io, match)
    if (!finishIfWon(io, match)) broadcastMatch(io, match)
  })

  socket.on('SABOTAGE_REQUEST', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    const res = r.match.sabotageAction(r.player.id, p?.type, p?.targetTaskId)
    if (typeof res === 'string') return ack(fail(res))
    ack(ok(undefined))
    for (const id of res.closedFor) {
      const pl = r.match.players.get(id)!
      interacting(io, r.match, id, pl.socketId, null)
    }
    news(io, r.match, p.type === 'POWER_CUT' ? 'POWER_SABOTAGED' : 'DOCUMENT_LEAK')
    sendCooldowns(io, r.match)
    broadcastMatch(io, r.match)
  })

  // Prompt 6 — reporting, meetings, voting
  socket.on('BODY_REPORTED', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    const reason = r.match.report(r.player.id, String(p?.bodyId ?? ''))
    if (reason) return ack(fail(reason))
    ack(ok(undefined))
    announceMeeting(io, r.match)
  })

  socket.on('EMERGENCY_MEETING', (ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    const reason = r.match.callEmergency(r.player.id)
    if (reason) return ack(fail(reason))
    ack(ok(undefined))
    announceMeeting(io, r.match)
  })

  socket.on('CHAT_SEND', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    const { match, player } = r
    if (!player.alive) return ack(fail('Eliminated players cannot chat'))
    if (match.state !== 'DISCUSSION' && match.state !== 'VOTING') return ack(fail('Chat opens during discussion'))
    const text = sanitiseChat(p?.text)
    if (!text) return ack(fail('Message is empty'))
    const now = Date.now()
    if (now - player.lastChatAt < MATCH_SETTINGS.chatMinIntervalMs) return ack(fail('Slow down'))
    player.lastChatAt = now
    ack(ok(undefined))
    io.to(livingSocketIds(match)).emit('CHAT_MESSAGE', { id: `c${++chatSeq}`, playerId: player.id, text, at: now })
  })

  socket.on('VOTE_SUBMITTED', (p, ack) => {
    const r = ref()
    if (!r) return ack(fail('Not in a room'))
    const res = r.match.vote(r.player.id, String(p?.choice ?? ''))
    if (typeof res === 'string') return ack(fail(res))
    ack(ok(undefined))
    io.to(r.match.roomCode).emit('VOTE_CAST', { voterId: r.player.id })
    if (res.allVoted) endVoting(io, r.match)
  })
}
