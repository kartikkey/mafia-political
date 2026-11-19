import { createAsyncThunk } from '@reduxjs/toolkit'
import { emitWithAck, gameSocket } from 'api/gameSocket'

export const createRoom = createAsyncThunk(
  'join/createRoom',
  async (p: { name: string; avatar: number }, { rejectWithValue }) => {
    try {
      return { ...(await emitWithAck('CREATE_ROOM', p)), ...p }
    } catch (e: any) {
      return rejectWithValue(e.message ?? 'Failed to create room')
    }
  }
)

export const joinRoom = createAsyncThunk(
  'join/joinRoom',
  async (p: { roomCode: string; name: string; avatar: number }, { rejectWithValue }) => {
    try {
      return { ...(await emitWithAck('JOIN_ROOM', { ...p, roomCode: p.roomCode.toUpperCase() })), name: p.name, avatar: p.avatar }
    } catch (e: any) {
      return rejectWithValue(e.message ?? 'Failed to join room')
    }
  }
)

export const leaveRoom = createAsyncThunk('join/leaveRoom', async () => {
  gameSocket.emit('LEAVE_ROOM')
})
