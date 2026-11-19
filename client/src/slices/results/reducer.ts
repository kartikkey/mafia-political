import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ClientMatchView, GameOverPayload } from '@netagiri/shared'
import { leaveRoom } from 'slices/join/thunk'
import { connectionLost } from 'slices/join/reducer'
import { returnToLobby } from './thunk'

interface ResultsState {
  gameOver: GameOverPayload | null
  submitLoading: boolean
  error: string | null
}

const initialState: ResultsState = { gameOver: null, submitLoading: false, error: null }

const resultsSlice = createSlice({
  name: 'results',
  initialState,
  reducers: {
    resetResults: () => initialState,
    gameOverReceived: (state, action: PayloadAction<GameOverPayload>) => {
      state.gameOver = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(returnToLobby.pending, (state) => {
        state.submitLoading = true
      })
      .addCase(returnToLobby.fulfilled, () => initialState)
      .addCase(returnToLobby.rejected, (state, action) => {
        state.submitLoading = false
        state.error = action.payload as string
      })
      .addCase(leaveRoom.fulfilled, () => initialState)
      .addCase(connectionLost, () => initialState)
      // Host reset the room → everyone's results clear.
      .addMatcher(
        (a): a is PayloadAction<ClientMatchView> => a.type === 'game/matchUpdated' && (a as PayloadAction<ClientMatchView>).payload?.state === 'WAITING',
        () => initialState
      )
  },
})

export const { resetResults, gameOverReceived } = resultsSlice.actions
export default resultsSlice.reducer
