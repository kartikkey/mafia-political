import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Body, ChatMessage, ClientMatchView, Direction, NewsKey, RoleAssignment, TaskPuzzle, Vec2 } from '@netagiri/shared'
import { leaveRoom } from 'slices/join/thunk'
import { connectionLost } from 'slices/join/reducer'
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
  activePuzzle: TaskPuzzle | null
  taskError: string | null
  taskBusy: boolean
  news: NewsItem[]
  /** playerId → taskId for everyone currently working a station (real or fake). */
  interacting: Record<string, string>
  /** Ghost whispers (eliminated players only), kept for the whole match. */
  ghostChat: ChatMessage[]
  /** Latest short feedback line ("Too far away", "Cooldown: 8s"). */
  feedback: string | null
  feedbackAt: number
}

const initialState: GameState = {
  match: null,
  role: null,
  eliminationReadyAt: 0,
  sabotageReadyAt: 0,
  activeTaskId: null,
  activePuzzle: null,
  taskError: null,
  taskBusy: false,
  news: [],
  interacting: {},
  ghostChat: [],
  feedback: null,
  feedbackAt: 0,
}

/** Rejections that keep the mini-game open so the player can retry. */
const RETRYABLE = ['Incorrect — try again', 'Keep holding', 'Slow down']

const clearTask = (state: GameState) => {
  state.activeTaskId = null
  state.activePuzzle = null
  state.taskError = null
  state.taskBusy = false
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    resetGame: () => initialState,
    matchUpdated: (state, action: PayloadAction<ClientMatchView>) => {
      state.match = action.payload
      if (action.payload.state !== 'PLAYING') {
        clearTask(state) // Spec §5.3
        state.interacting = {}
      }
      if (state.activeTaskId && action.payload.sabotage.disabledTaskIds.includes(state.activeTaskId)) {
        clearTask(state)
        state.feedback = 'Documents leaked — station offline'
        state.feedbackAt = Date.now()
      }
      if (action.payload.state === 'WAITING' || action.payload.state === 'ROLE_ASSIGNMENT') state.ghostChat = []
      if (action.payload.state === 'WAITING') {
        state.role = null
        state.news = []
        state.eliminationReadyAt = 0
        state.sabotageReadyAt = 0
      }
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
      if (state.activeTaskId === action.payload.taskId) clearTask(state) // someone else finished it first
    },
    playerEliminated: (state, action: PayloadAction<{ body: Body; meId: string | null }>) => {
      if (!state.match) return
      if (!state.match.bodies.some((b) => b.bodyId === action.payload.body.bodyId)) state.match.bodies.push(action.payload.body)
      const p = state.match.players.find((x) => x.id === action.payload.body.playerId)
      if (p) p.alive = false
      if (action.payload.body.playerId === action.payload.meId) clearTask(state) // Spec §6.5
    },
    cooldownUpdated: (state, action: PayloadAction<{ eliminationReadyAt: number; sabotageReadyAt: number }>) => {
      state.eliminationReadyAt = action.payload.eliminationReadyAt
      state.sabotageReadyAt = action.payload.sabotageReadyAt
    },
    newsReceived: (state, action: PayloadAction<NewsItem>) => {
      state.news = [...state.news.slice(-9), action.payload]
    },
    closeTask: clearTask,
    ghostChatReceived: (state, action: PayloadAction<ChatMessage>) => {
      state.ghostChat = [...state.ghostChat.slice(-49), action.payload]
    },
    playerInteracting: (state, action: PayloadAction<{ playerId: string; taskId: string | null }>) => {
      if (action.payload.taskId) state.interacting[action.payload.playerId] = action.payload.taskId
      else delete state.interacting[action.payload.playerId]
    },
    setFeedback: (state, action: PayloadAction<string | null>) => {
      state.feedback = action.payload
      state.feedbackAt = Date.now()
    },
  },
  extraReducers: (builder) => {
    builder.addCase(openTask.fulfilled, (state, action) => {
      state.activeTaskId = action.meta.arg
      state.activePuzzle = action.payload.puzzle as TaskPuzzle
      state.taskError = null
    })
    builder.addCase(completeTask.pending, (state) => {
      state.taskBusy = true
      state.taskError = null
    })
    builder.addCase(completeTask.fulfilled, (state) => {
      clearTask(state)
      state.feedback = 'Task complete'
      state.feedbackAt = Date.now()
    })
    builder.addCase(completeTask.rejected, (state, action) => {
      const reason = (action.payload as string) ?? 'Action rejected'
      state.taskBusy = false
      if (RETRYABLE.includes(reason)) {
        state.taskError = reason
      } else {
        clearTask(state)
        state.feedback = reason
        state.feedbackAt = Date.now()
      }
    })
    for (const t of [openTask, eliminatePlayer, sabotage, reportBody, callEmergencyMeeting]) {
      builder.addCase(t.rejected, (state, action) => {
        state.feedback = (action.payload as string) ?? 'Action rejected'
        state.feedbackAt = Date.now()
      })
    }
    builder.addCase(leaveRoom.fulfilled, () => initialState)
    builder.addCase(connectionLost, () => initialState)
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
  playerInteracting,
  ghostChatReceived,
  setFeedback,
} = gameSlice.actions
export default gameSlice.reducer
