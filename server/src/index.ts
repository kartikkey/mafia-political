import { createServer } from 'node:http'
import express from 'express'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@netagiri/shared'
import { RoomManager } from './rooms/RoomManager'
import { registerLobbyHandlers } from './handlers/lobbyHandlers'
import { registerGameHandlers } from './handlers/gameHandlers'

const PORT = Number(process.env.SERVER_PORT ?? 8001)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000'
const SOCKET_PATH = process.env.SOCKET_PATH ?? '/api/socket.io'

const app = express()
app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true }))

const httpServer = createServer(app)
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  path: SOCKET_PATH,
  cors: { origin: CLIENT_ORIGIN.split(',') },
})

const rooms = new RoomManager()

io.on('connection', (socket) => {
  const ctx = { io, socket, rooms }
  registerLobbyHandlers(ctx)
  registerGameHandlers(ctx)
})

httpServer.listen(PORT, () => {
  console.log(`[netagiri] server listening on :${PORT} path ${SOCKET_PATH} (client origin ${CLIENT_ORIGIN})`)
})
