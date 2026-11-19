import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Body, ClientMatchView, Direction, NewsKey, RoleAssignment, Vec2 } from '@netagiri/shared'
import { callEmergencyMeeting, completeTask, eliminatePlayer, openTask, reportBody, sabotage } from './thunk'

interface NewsItem {
  key: NewsKey
  at: number
}

interface GameState {
  match: ClientMatchView | null
  role: RoleAssignment | null
  eliminationReadyAt: number
  sabotageReadyAt: number
  activeTaskId: string | null
  activePuzzle: unknown
  news: NewsItem[]
  /** Latest short feedback line ("Too far away", "Cooldown: 8s"). */
  feedback: string | null
}

const initialState: GameState = {
  match: null,
  role: null,
  eliminationReadyAt: 0,
  sabotageReadyAt: 0,
  activeTaskId: null,
  activePuzzle: null,
  news: [],
  feedback: null,
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    resetGame: () => initialState,
    matchUpdated: (state, action: PayloadAction<ClientMatchView>) => {
      state.match = action.payload
      if (action.payload.state !== 'PLAYING') state.activeTaskId = null // Spec §5.3
      if (action.payload.state === 'WAITING') state.role = null
    },
    roleAssigned: (state, action: PayloadAction<RoleAssignment>) => {
      state.role = action.payload
    },
    playerMoved: (state, action: PayloadAction<{ playerId: string; position: Vec2; facing: Direction }>) => {
      const p = state.match?.players.find((x) => x.id === action.payload.playerId)
      if (p) {
        p.position = action.payload.position
        p.facing = action.payload.facing
      }
    },
    taskProgress: (state, action: PayloadAction<{ taskId: string; completedTasks: number; totalTasks: number }>) => {
      if (!state.match) return
      state.match.completedTasks = action.payload.completedTasks
      state.match.totalTasks = action.payload.totalTasks
      const t = state.match.tasks.find((x) => x.taskId === action.payload.taskId)
      if (t) t.status = 'COMPLETE'
    },
    playerEliminated: (state, action: PayloadAction<{ body: Body }>) => {
      if (!state.match) return
      state.match.bodies.push(action.payload.body)
      const p = state.match.players.find((x) => x.id === action.payload.body.playerId)
      if (p) p.alive = false
    },
    cooldownUpdated: (state, action: PayloadAction<{ eliminationReadyAt: number; sabotageReadyAt: number }>) => {
      state.eliminationReadyAt = action.payload.eliminationReadyAt
      state.sabotageReadyAt = action.payload.sabotageReadyAt
    },
    newsReceived: (state, action: PayloadAction<NewsItem>) => {
      state.news = [...state.news.slice(-9), action.payload]
    },
    closeTask: (state) => {
      state.activeTaskId = null
      state.activePuzzle = null
    },
    setFeedback: (state, action: PayloadAction<string | null>) => {
      state.feedback = action.payload
    },
  },
  extraReducers: (builder) => {
    builder.addCase(openTask.fulfilled, (state, action) => {
      state.activeTaskId = action.meta.arg
      state.activePuzzle = action.payload.puzzle
    })
    builder.addCase(completeTask.fulfilled, (state) => {
      state.activeTaskId = null
      state.activePuzzle = null
    })
    for (const t of [openTask, completeTask, eliminatePlayer, sabotage, reportBody, callEmergencyMeeting]) {
      builder.addCase(t.rejected, (state, action) => {
        state.feedback = (action.payload as string) ?? 'Action rejected'
      })
    }
  },
})

export const {
  resetGame,
  matchUpdated,
  roleAssigned,
  playerMoved,
  taskProgress,
  playerEliminated,
  cooldownUpdated,
  newsReceived,
  closeTask,
  setFeedback,
} = gameSlice.actions
export default gameSlice.reducer
