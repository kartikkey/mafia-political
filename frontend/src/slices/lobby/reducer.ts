import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { LobbyView } from '@netagiri/shared'
import { addBots, removeBot, removeBots, setAvatar, startGame } from './thunk'
import { leaveRoom } from 'slices/join/thunk'
import { connectionLost } from 'slices/join/reducer'

interface LobbyState {
  lobby: LobbyView | null
  submitLoading: boolean
  error: string | null
  closedReason: string | null
}

const initialState: LobbyState = { lobby: null, submitLoading: false, error: null, closedReason: null }

const lobbySlice = createSlice({
  name: 'lobby',
  initialState,
  reducers: {
    resetLobby: () => initialState,
    lobbyUpdated: (state, action: PayloadAction<LobbyView>) => {
      state.lobby = action.payload
    },
    roomClosed: (state, action: PayloadAction<string>) => {
      state.closedReason = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startGame.pending, (state) => {
        state.submitLoading = true
        state.error = null
      })
      .addCase(startGame.fulfilled, (state) => {
        state.submitLoading = false
      })
      .addCase(startGame.rejected, (state, action) => {
        state.submitLoading = false
        state.error = action.payload as string
      })
      .addCase(setAvatar.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(addBots.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(removeBot.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(removeBots.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(leaveRoom.fulfilled, () => initialState)
      .addCase(connectionLost, () => initialState)
  },
})

export const { resetLobby, lobbyUpdated, roomClosed } = lobbySlice.actions
export default lobbySlice.reducer
