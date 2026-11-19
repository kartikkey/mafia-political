/**
 * Server → client event bridge. The ONLY place socket listeners are
 * registered; each event maps to a slice action.
 */
import type { Dispatch } from '@reduxjs/toolkit'
import type { GameSocket } from './gameSocket'
import { setConnected } from 'slices/join/reducer'
import { lobbyUpdated, roomClosed } from 'slices/lobby/reducer'
import {
  cooldownUpdated,
  matchUpdated,
  newsReceived,
  playerEliminated,
  playerMoved,
  roleAssigned,
  taskProgress,
} from 'slices/game/reducer'
import { chatReceived, meetingStarted, voteCast, voteResults } from 'slices/meeting/reducer'
import { gameOverReceived } from 'slices/results/reducer'

export function bindServerEvents(socket: GameSocket, dispatch: Dispatch) {
  socket.on('connect', () => dispatch(setConnected(true)))
  socket.on('disconnect', () => dispatch(setConnected(false)))

  socket.on('LOBBY_UPDATED', (lobby) => dispatch(lobbyUpdated(lobby)))
  socket.on('ROOM_CLOSED', ({ reason }) => dispatch(roomClosed(reason)))

  socket.on('GAME_STARTED', (view) => dispatch(matchUpdated(view)))
  socket.on('MATCH_STATE', (view) => dispatch(matchUpdated(view)))
  socket.on('ROLE_ASSIGNED', (role) => dispatch(roleAssigned(role)))
  socket.on('PLAYER_MOVED', (p) => dispatch(playerMoved(p)))

  socket.on('TASK_PROGRESS', (p) => dispatch(taskProgress(p)))
  socket.on('PLAYER_ELIMINATED', (p) => dispatch(playerEliminated(p)))
  socket.on('COOLDOWN', (p) => dispatch(cooldownUpdated(p)))

  socket.on('MEETING_STARTED', (p) => dispatch(meetingStarted(p)))
  socket.on('CHAT_MESSAGE', (m) => dispatch(chatReceived(m)))
  socket.on('VOTE_CAST', ({ voterId }) => dispatch(voteCast(voterId)))
  socket.on('VOTE_RESULTS', (t) => dispatch(voteResults(t)))

  socket.on('NEWS', (n) => dispatch(newsReceived(n)))
  socket.on('GAME_OVER', (p) => dispatch(gameOverReceived(p)))
}
