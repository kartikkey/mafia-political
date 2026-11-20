/** Session identity: who am I and which room am I in. */
import { createAction, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createRoom, joinRoom, leaveRoom, rejoinMatch } from './thunk'
import { loadSession } from 'helpers/session'

interface JoinState {
  playerId: string | null
  roomCode: string | null
  name: string
  avatar: number
  connected: boolean
  /** Socket dropped mid-match; the seat is held while we reconnect. */
  reconnecting: boolean
  /** A rejoin attempt is pending (also true on boot when this tab has a saved seat). */
  rejoining: boolean
  submitLoading: boolean
  error: string | null
}

const initialState: JoinState = {
  playerId: null,
  roomCode: null,
  name: '',
  avatar: 0,
  connected: false,
  reconnecting: false,
  rejoining: false,
  submitLoading: false,
  error: null,
}

/** Seat lost (lobby drop, failed rejoin, kicked): every slice resets. Optional reason is shown on the join screen. */
export const connectionLost = createAction<string | undefined>('join/connectionLost')
/** Socket dropped mid-match: keep everything and wait for the reconnect. */
export const connectionDropped = createAction('join/connectionDropped')

const joinSlice = createSlice({
  name: 'join',
  initialState: () => ({ ...initialState, rejoining: !!loadSession() }),
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
    builder
      .addCase(rejoinMatch.pending, (state) => {
        state.rejoining = true
      })
      .addCase(rejoinMatch.fulfilled, (state, action) => {
        Object.assign(state, action.payload, { reconnecting: false, rejoining: false, error: null })
      })
      .addCase(rejoinMatch.rejected, (state) => {
        state.rejoining = false
      })
      .addCase(connectionDropped, (state) => {
        state.connected = false
        state.reconnecting = true
      })
    builder.addCase(leaveRoom.fulfilled, (state) => ({ ...initialState, connected: state.connected, name: state.name, avatar: state.avatar }))
    builder.addCase(connectionLost, (state, action) => ({
      ...initialState,
      connected: state.connected,
      name: state.name,
      avatar: state.avatar,
      error: action.payload ?? (state.roomCode ? 'Connection lost — your seat could not be kept. Rejoin with a room code.' : null),
    }))
  },
})

export const { resetJoin, setConnected, clearJoinError } = joinSlice.actions
export default joinSlice.reducer
