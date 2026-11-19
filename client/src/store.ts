import { configureStore } from '@reduxjs/toolkit'
import joinReducer from 'slices/join/reducer'
import lobbyReducer from 'slices/lobby/reducer'
import gameReducer from 'slices/game/reducer'
import meetingReducer from 'slices/meeting/reducer'
import resultsReducer from 'slices/results/reducer'
import { gameSocket } from 'api/gameSocket'
import { bindServerEvents } from 'api/serverEvents'

export const store = configureStore({
  reducer: {
    join: joinReducer,
    lobby: lobbyReducer,
    game: gameReducer,
    meeting: meetingReducer,
    results: resultsReducer,
  },
})

bindServerEvents(gameSocket, store.dispatch, () => store.getState().join.playerId)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
