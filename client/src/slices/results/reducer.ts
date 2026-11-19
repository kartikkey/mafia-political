import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { GameOverPayload } from '@netagiri/shared'
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
  },
})

export const { resetResults, gameOverReceived } = resultsSlice.actions
export default resultsSlice.reducer
