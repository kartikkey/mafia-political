/**
 * In-match actions. Movement is live (Phase 1/2); the rest are stubs that
 * reject cleanly until their prompt in docs/PROJECT_PLAN.md is built.
 * Every handler must: resolve the player from the socket (never trust a
 * client-supplied id), check match.state, validate range/cooldown/faction,
 * then mutate + broadcast.
 */
import { fail, type HandlerContext } from './types'

const NOT_YET = 'Not implemented yet'

export function registerGameHandlers({ socket, rooms }: HandlerContext) {
  socket.on('PLAYER_MOVED', (p) => {
    const ref = rooms.bySocket(socket.id)
    if (!ref || !p?.position) return
    const accepted = ref.match.move(ref.player.id, p.position, p.facing ?? 'down')
    if (accepted) {
      socket.to(ref.match.roomCode).emit('PLAYER_MOVED', { playerId: ref.player.id, position: p.position, facing: ref.player.facing })
    } else {
      // Snap the mover back to the authoritative position.
      socket.emit('PLAYER_MOVED', { playerId: ref.player.id, position: ref.player.position, facing: ref.player.facing })
    }
  })

  // Prompt 4 — tasks & mini-games
  socket.on('TASK_OPENED', (_p, ack) => ack(fail(NOT_YET)))
  socket.on('TASK_COMPLETED', (_p, ack) => ack(fail(NOT_YET)))

  // Prompt 5 — Deep State actions
  socket.on('PLAYER_ELIMINATE_REQUEST', (_p, ack) => ack(fail(NOT_YET)))
  socket.on('SABOTAGE_REQUEST', (_p, ack) => ack(fail(NOT_YET)))

  // Prompt 6 — reporting, meetings, voting
  socket.on('BODY_REPORTED', (_p, ack) => ack(fail(NOT_YET)))
  socket.on('EMERGENCY_MEETING', (ack) => ack(fail(NOT_YET)))
  socket.on('CHAT_SEND', (_p, ack) => ack(fail(NOT_YET)))
  socket.on('VOTE_SUBMITTED', (_p, ack) => ack(fail(NOT_YET)))
}
