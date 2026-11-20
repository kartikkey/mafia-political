import { createAsyncThunk } from '@reduxjs/toolkit'
import { emitWithAck, gameSocket } from 'api/gameSocket'
import { clearSession, loadSession, saveSession } from 'helpers/session'

export const createRoom = createAsyncThunk(
  'join/createRoom',
  async (p: { name: string; avatar: number }, { rejectWithValue }) => {
    try {
      const res = await emitWithAck('CREATE_ROOM', p)
      saveSession({ roomCode: res.roomCode, playerId: res.playerId, token: res.rejoinToken })
      return { roomCode: res.roomCode, playerId: res.playerId, ...p }
    } catch (e: any) {
      return rejectWithValue(e.message ?? 'Failed to create room')
    }
  }
)

export const joinRoom = createAsyncThunk(
  'join/joinRoom',
  async (p: { roomCode: string; name: string; avatar: number }, { rejectWithValue }) => {
    try {
      const res = await emitWithAck('JOIN_ROOM', { ...p, roomCode: p.roomCode.toUpperCase() })
      saveSession({ roomCode: res.roomCode, playerId: res.playerId, token: res.rejoinToken })
      return { roomCode: res.roomCode, playerId: res.playerId, name: p.name, avatar: p.avatar }
    } catch (e: any) {
      return rejectWithValue(e.message ?? 'Failed to join room')
    }
  }
)

/** Reclaim this tab's seat after a dropped connection or a page reload. */
export const rejoinMatch = createAsyncThunk('join/rejoinMatch', async (_: void, { rejectWithValue }) => {
  const session = loadSession()
  if (!session) return rejectWithValue('No session')
  try {
    return await emitWithAck('REJOIN', session)
  } catch (e: any) {
    clearSession()
    return rejectWithValue(e.message ?? 'Session expired')
  }
})

export const leaveRoom = createAsyncThunk('join/leaveRoom', async () => {
  clearSession()
  gameSocket.emit('LEAVE_ROOM')
})
