/**
 * The single transport instance for this app — the socket equivalent of a
 * per-domain axios instance. Only thunks (slices/*\/thunk.ts) and
 * api/serverEvents.ts may import it. Pages never touch the socket directly.
 */
import { io, type Socket } from 'socket.io-client'
import type { AckResult, ClientToServerEvents, ServerToClientEvents } from '@netagiri/shared'
import { env } from 'config/env'

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const gameSocket: GameSocket = io(env.serverUrl, { autoConnect: true, transports: ['websocket'] })

type AckEvents = {
  [K in keyof ClientToServerEvents]: Parameters<ClientToServerEvents[K]> extends [...infer _A, (res: AckResult<infer _T>) => void] ? K : never
}[keyof ClientToServerEvents]

type AckData<K extends AckEvents> = Parameters<ClientToServerEvents[K]> extends [...infer _A, (res: AckResult<infer T>) => void] ? T : never
type AckArgs<K extends AckEvents> = Parameters<ClientToServerEvents[K]> extends [...infer A, (res: AckResult<any>) => void] ? A : never

/**
 * Emit an event that expects an acknowledgement and resolve with its data,
 * or reject with the server's human-readable reason.
 */
export function emitWithAck<K extends AckEvents>(event: K, ...args: AckArgs<K>): Promise<AckData<K>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not respond')), 5000)
    ;(gameSocket.emit as any)(event, ...args, (res: AckResult<AckData<K>>) => {
      clearTimeout(timeout)
      if (res.ok) resolve(res.data)
      else reject(new Error(res.reason))
    })
  })
}
