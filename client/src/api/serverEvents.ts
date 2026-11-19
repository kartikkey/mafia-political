/**
 * Server → client event bridge. The ONLY place socket listeners are
 * registered; each event maps to a slice action (+ a short sound cue).
 */
import type { Dispatch } from '@reduxjs/toolkit'
import type { GameSocket } from './gameSocket'
import { connectionLost, setConnected } from 'slices/join/reducer'
import { lobbyUpdated, roomClosed } from 'slices/lobby/reducer'
import {
  cooldownUpdated,
  matchUpdated,
  newsReceived,
  playerEliminated,
  playerInteracting,
  playerMoved,
  roleAssigned,
  taskProgress,
} from 'slices/game/reducer'
import { chatReceived, meetingStarted, voteCast, voteResults } from 'slices/meeting/reducer'
import { gameOverReceived } from 'slices/results/reducer'
import { playSound } from 'helpers/sound'
import { syncClock } from 'slices/game/thunk'
import { CLOCK_RESYNC_MS } from 'config/constants'

export function bindServerEvents(socket: GameSocket, dispatch: Dispatch, getMeId: () => string | null) {
  // Thunk dispatch through the plain Dispatch type (store is configured with thunk middleware).
  const resync = () => void (dispatch as (a: unknown) => unknown)(syncClock())
  socket.on('connect', () => {
    dispatch(setConnected(true))
    resync()
  })
  // Periodic resync corrects drift (long sessions, laptop sleep).
  setInterval(() => socket.connected && resync(), CLOCK_RESYNC_MS)
  socket.on('disconnect', () => {
    dispatch(setConnected(false))
    dispatch(connectionLost())
  })

  socket.on('LOBBY_UPDATED', (lobby) => dispatch(lobbyUpdated(lobby)))
  socket.on('ROOM_CLOSED', ({ reason }) => dispatch(roomClosed(reason)))

  socket.on('GAME_STARTED', (view) => {
    resync()
    playSound('start')
    dispatch(matchUpdated(view))
  })
  socket.on('MATCH_STATE', (view) => dispatch(matchUpdated(view)))
  socket.on('ROLE_ASSIGNED', (role) => dispatch(roleAssigned(role)))
  socket.on('PLAYER_MOVED', (p) => dispatch(playerMoved(p)))

  socket.on('TASK_PROGRESS', (p) => dispatch(taskProgress(p)))
  socket.on('PLAYER_ELIMINATED', (p) => {
    playSound('eliminate')
    dispatch(playerEliminated({ body: p.body, meId: getMeId() }))
  })
  socket.on('COOLDOWN', (p) => dispatch(cooldownUpdated(p)))
  socket.on('PLAYER_INTERACTING', (p) => dispatch(playerInteracting(p)))

  socket.on('MEETING_STARTED', (p) => {
    playSound('siren')
    dispatch(meetingStarted(p))
  })
  socket.on('CHAT_MESSAGE', (m) => {
    playSound('chat')
    dispatch(chatReceived(m))
  })
  socket.on('VOTE_CAST', ({ voterId }) => {
    playSound('vote')
    dispatch(voteCast(voterId))
  })
  socket.on('VOTE_RESULTS', (t) => {
    playSound(t.ejectedPlayerId ? 'eject' : 'vote')
    dispatch(voteResults(t))
  })

  socket.on('NEWS', (n) => {
    if (n.key === 'POWER_SABOTAGED' || n.key === 'DOCUMENT_LEAK') playSound('alarm')
    if (n.key === 'POWER_RESTORED') playSound('success')
    dispatch(newsReceived(n))
  })
  socket.on('GAME_OVER', (p) => {
    playSound(p.result === 'GOVERNMENT_WINS' ? 'win' : 'lose')
    dispatch(gameOverReceived(p))
  })
}
