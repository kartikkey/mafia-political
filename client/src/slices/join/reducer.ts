/** Session identity: who am I and which room am I in. */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createRoom, joinRoom, leaveRoom } from './thunk'

interface JoinState {
  playerId: string | null
  roomCode: string | null
  name: string
  avatar: number
  connected: boolean
  submitLoading: boolean
  error: string | null
}

const initialState: JoinState = {
  playerId: null,
  roomCode: null,
  name: '',
  avatar: 0,
  connected: false,
  submitLoading: false,
  error: null,
}

const joinSlice = createSlice({
  name: 'join',
  initialState,
  reducers: {
    resetJoin: () => initialState,
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload
    },
    clearJoinError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    for (const thunk of [createRoom, joinRoom]) {
      builder
        .addCase(thunk.pending, (state) => {
          state.submitLoading = true
          state.error = null
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.submitLoading = false
          state.playerId = action.payload.playerId
          state.roomCode = action.payload.roomCode
          state.name = action.payload.name
          state.avatar = action.payload.avatar
        })
        .addCase(thunk.rejected, (state, action) => {
          state.submitLoading = false
          state.error = action.payload as string
        })
    }
    builder.addCase(leaveRoom.fulfilled, (state) => ({ ...initialState, connected: state.connected, name: state.name, avatar: state.avatar }))
  },
})

export const { resetJoin, setConnected, clearJoinError } = joinSlice.actions
export default joinSlice.reducer
