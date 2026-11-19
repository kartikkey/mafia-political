import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@netagiri/shared'
import type { RoomManager } from '../rooms/RoomManager'

export type IO = Server<ClientToServerEvents, ServerToClientEvents>
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export interface HandlerContext {
  io: IO
  socket: GameSocket
  rooms: RoomManager
}

export const fail = (reason: string) => ({ ok: false as const, reason })
export const ok = <T>(data: T) => ({ ok: true as const, data })
