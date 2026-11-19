/**
 * Match flow + broadcasting: phase timers, meetings, votes, victory.
 * The single place that turns Match state changes into room events.
 */
import { MATCH_SETTINGS, type MatchState, type NewsKey } from '@netagiri/shared'
import type { IO } from '../handlers/types'
import type { Match } from './Match'

export const broadcastMatch = (io: IO, match: Match) => io.to(match.roomCode).emit('MATCH_STATE', match.view())

export const news = (io: IO, match: Match, key: NewsKey) => io.to(match.roomCode).emit('NEWS', { key, at: Date.now() })

/** Private cooldown push: elimination timer per agent, sabotage timer team-wide. */
export function sendCooldowns(io: IO, match: Match) {
  for (const p of match.players.values()) {
    if (p.faction !== 'DEEP_STATE' || !p.connected) continue
    io.to(p.socketId).emit('COOLDOWN', { eliminationReadyAt: p.eliminationReadyAt, sabotageReadyAt: match.sabotageReadyAt })
  }
}

/** Spec §9.3 — call after every task, elimination, vote result and disconnect. */
export function finishIfWon(io: IO, match: Match): boolean {
  const result = match.finishIfWon()
  if (!result) return false
  broadcastMatch(io, match)
  io.to(match.roomCode).emit('GAME_OVER', { result, stats: match.matchStats() })
  news(io, match, result)
  return true
}

/** After Match.report / Match.callEmergency succeeded. */
export function announceMeeting(io: IO, match: Match) {
  const m = match.meeting!
  io.to(match.roomCode).emit('MEETING_STARTED', { reason: m.reason, callerId: m.callerId, bodyId: m.bodyId, phaseEndsAt: match.phaseEndsAt ?? Date.now() })
  news(io, match, m.reason === 'BODY' ? 'BODY_REPORTED' : 'MEETING_STARTED')
  broadcastMatch(io, match)
}

export function endVoting(io: IO, match: Match) {
  if (match.state !== 'VOTING') return // late vote / timer race: only the first caller resolves
  const tally = match.resolveVotes()
  io.to(match.roomCode).emit('VOTE_RESULTS', tally)
  news(io, match, tally.ejectedPlayerId ? 'PLAYER_VOTED_OUT' : 'NO_EJECTION')
  broadcastMatch(io, match)
}

/** Living players only: dead players cannot read or send chat (Spec §1.2, §8.5). */
export function livingSocketIds(match: Match) {
  return match.livingPlayers.map((p) => p.socketId)
}

export function wireMatch(io: IO, match: Match) {
  match.onPhaseEnd = (state) => onPhaseEnd(io, match, state)
  match.onPowerRestored = () => {
    news(io, match, 'POWER_RESTORED')
    broadcastMatch(io, match)
  }
}

function onPhaseEnd(io: IO, match: Match, state: MatchState) {
  if (match.state !== state) return // stale timer
  switch (state) {
    case 'ROLE_ASSIGNMENT':
      match.setState('PLAYING')
      if (finishIfWon(io, match)) return // Spec §9.3: configuration check at start
      broadcastMatch(io, match)
      return
    case 'MEETING_TRANSITION':
      match.setState('DISCUSSION', MATCH_SETTINGS.discussionMs)
      broadcastMatch(io, match)
      return
    case 'DISCUSSION':
      match.setState('VOTING', MATCH_SETTINGS.votingMs)
      broadcastMatch(io, match)
      return
    case 'VOTING':
      endVoting(io, match)
      return
    case 'VOTE_RESULTS':
      if (finishIfWon(io, match)) return
      match.resumePlay()
      broadcastMatch(io, match)
      return
  }
}
