/**
 * Validated in-match actions + their broadcasts. Used by socket handlers and
 * by computer players, so bots follow exactly the same rules as humans.
 * Each returns a rejection reason, or null on success.
 */
import { MATCH_SETTINGS, type ChatMessage, type Direction, type SabotageType, type VoteChoice, type Vec2 } from '@netagiri/shared'
import type { IO } from '../handlers/types'
import { announceMeeting, broadcastMatch, endVoting, finishIfWon, interacting, livingSocketIds, news, sendCooldowns } from './flow'
import type { Match, ServerPlayer } from './Match'

let chatSeq = 0

const sanitiseChat = (raw: unknown) =>
  typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MATCH_SETTINGS.chatMaxLength) : ''

const ghostSockets = (match: Match, except?: string) =>
  [...match.players.values()].filter((x) => !x.alive && x.connected && x.id !== except).map((x) => x.socketId)

/** Accepted moves fan out to the room (living) or to other ghosts only. Returns acceptance. */
export function actMove(io: IO, match: Match, p: ServerPlayer, position: Vec2, facing: Direction): boolean {
  if (!match.move(p.id, position, facing)) return false
  const msg = { playerId: p.id, position, facing: p.facing }
  if (p.alive) io.to(match.roomCode).except(p.socketId).emit('PLAYER_MOVED', msg)
  else {
    const ghosts = ghostSockets(match, p.id)
    if (ghosts.length) io.to(ghosts).emit('PLAYER_MOVED', msg)
  }
  return true
}

export function actOpenTask(io: IO, match: Match, p: ServerPlayer, taskId: string) {
  const res = match.openTask(p.id, taskId)
  if (typeof res !== 'string') interacting(io, match, p.id, p.socketId, taskId)
  return res
}

export function actCompleteTask(io: IO, match: Match, p: ServerPlayer, taskId: string, payload: unknown): string | null {
  const res = match.completeTask(p.id, taskId, payload)
  if (!p.openTask) interacting(io, match, p.id, p.socketId, null)
  if (typeof res === 'string') return res
  if (res.restored) {
    news(io, match, 'POWER_RESTORED')
    broadcastMatch(io, match)
  }
  if (res.progressed) {
    io.to(match.roomCode).emit('TASK_PROGRESS', { taskId, completedTasks: match.completedTasks, totalTasks: match.tasks.length })
    finishIfWon(io, match)
  }
  return null
}

export function actEliminate(io: IO, match: Match, p: ServerPlayer, targetId: string): string | null {
  const victim = match.players.get(targetId)
  const wasWorking = !!victim?.openTask
  const body = match.eliminate(p.id, targetId)
  if (typeof body === 'string') return body
  if (wasWorking && victim) interacting(io, match, victim.id, victim.socketId, null)
  io.to(match.roomCode).emit('PLAYER_ELIMINATED', { body, livingCount: match.livingPlayers.length })
  sendCooldowns(io, match)
  if (!finishIfWon(io, match)) broadcastMatch(io, match)
  return null
}

export function actSabotage(io: IO, match: Match, p: ServerPlayer, type: SabotageType, targetTaskId?: string): string | null {
  const res = match.sabotageAction(p.id, type, targetTaskId)
  if (typeof res === 'string') return res
  for (const id of res.closedFor) interacting(io, match, id, match.players.get(id)!.socketId, null)
  news(io, match, type === 'POWER_CUT' ? 'POWER_SABOTAGED' : 'DOCUMENT_LEAK')
  sendCooldowns(io, match)
  broadcastMatch(io, match)
  return null
}

export function actReport(io: IO, match: Match, p: ServerPlayer, bodyId: string): string | null {
  const reason = match.report(p.id, bodyId)
  if (!reason) announceMeeting(io, match)
  return reason
}

export function actEmergency(io: IO, match: Match, p: ServerPlayer): string | null {
  const reason = match.callEmergency(p.id)
  if (!reason) announceMeeting(io, match)
  return reason
}

export function actVote(io: IO, match: Match, p: ServerPlayer, choice: VoteChoice): string | null {
  const res = match.vote(p.id, choice)
  if (typeof res === 'string') return res
  io.to(match.roomCode).emit('VOTE_CAST', { voterId: p.id })
  if (res.allVoted) endVoting(io, match)
  return null
}

/**
 * Living players: meeting chat for the living only. Eliminated players: ghost
 * whispers, any time during the match, delivered only to other ghosts.
 */
export function actChat(io: IO, match: Match, p: ServerPlayer, raw: unknown): string | null {
  const ghost = !p.alive
  if (!match.inMatch) return 'Chat is closed'
  if (!ghost && match.state !== 'DISCUSSION' && match.state !== 'VOTING') return 'Chat opens during discussion'
  const text = sanitiseChat(raw)
  if (!text) return 'Message is empty'
  const now = Date.now()
  if (now - p.lastChatAt < MATCH_SETTINGS.chatMinIntervalMs) return 'Slow down'
  p.lastChatAt = now
  const msg: ChatMessage = { id: `c${++chatSeq}`, playerId: p.id, text, at: now, ...(ghost ? { ghost: true } : {}) }
  const to = ghost ? ghostSockets(match) : livingSocketIds(match)
  if (to.length) io.to(to).emit('CHAT_MESSAGE', msg)
  return null
}
