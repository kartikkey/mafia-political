import { createServer } from 'node:http'
import express from 'express'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@netagiri/shared'
import { RoomManager } from './rooms/RoomManager'
import { registerLobbyHandlers } from './handlers/lobbyHandlers'
import { registerGameHandlers } from './handlers/gameHandlers'

const PORT = Number(process.env.PORT ?? 3001)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

const app = express()
app.get('/health', (_req, res) => res.json({ ok: true }))

const httpServer = createServer(app)
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGIN.split(',') },
})

const rooms = new RoomManager()

io.on('connection', (socket) => {
  const ctx = { io, socket, rooms }
  registerLobbyHandlers(ctx)
  registerGameHandlers(ctx)
})

httpServer.listen(PORT, () => {
  console.log(`[netagiri] server listening on :${PORT} (client origin ${CLIENT_ORIGIN})`)
})
