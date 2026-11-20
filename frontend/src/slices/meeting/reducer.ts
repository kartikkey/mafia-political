import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ChatMessage, LeakClue, MeetingReplay, VoteChoice, VoteTally } from '@netagiri/shared'
import { leaveRoom } from 'slices/join/thunk'
import { connectionLost } from 'slices/join/reducer'
import { sendChat, submitVote } from './thunk'

interface MeetingState {
  reason: 'BODY' | 'EMERGENCY' | null
  callerId: string | null
  bodyId: string | null
  clue: LeakClue | null
  replay: MeetingReplay | null
  chat: ChatMessage[]
  votedPlayerIds: string[]
  myVote: VoteChoice | null
  tally: VoteTally | null
  submitLoading: boolean
  error: string | null
}

const initialState: MeetingState = {
  reason: null,
  callerId: null,
  bodyId: null,
  clue: null,
  replay: null,
  chat: [],
  votedPlayerIds: [],
  myVote: null,
  tally: null,
  submitLoading: false,
  error: null,
}

const meetingSlice = createSlice({
  name: 'meeting',
  initialState,
  reducers: {
    resetMeeting: () => initialState,
    meetingStarted: (_state, action: PayloadAction<{ reason: 'BODY' | 'EMERGENCY'; callerId: string; bodyId?: string; clue?: LeakClue; replay?: MeetingReplay }>) => ({
      ...initialState,
      reason: action.payload.reason,
      callerId: action.payload.callerId,
      bodyId: action.payload.bodyId ?? null,
      clue: action.payload.clue ?? null,
      replay: action.payload.replay ?? null,
    }),
    chatReceived: (state, action: PayloadAction<ChatMessage>) => {
      state.chat = [...state.chat.slice(-49), action.payload]
    },
    voteCast: (state, action: PayloadAction<string>) => {
      if (!state.votedPlayerIds.includes(action.payload)) state.votedPlayerIds.push(action.payload)
    },
    voteResults: (state, action: PayloadAction<VoteTally>) => {
      state.tally = action.payload
    },
    clearMeetingError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitVote.pending, (state) => {
        state.submitLoading = true
        state.error = null
      })
      .addCase(submitVote.fulfilled, (state, action) => {
        state.submitLoading = false
        state.myVote = action.payload
      })
      .addCase(submitVote.rejected, (state, action) => {
        state.submitLoading = false
        state.error = action.payload as string
      })
      .addCase(sendChat.pending, (state) => {
        state.error = null
      })
      .addCase(sendChat.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(leaveRoom.fulfilled, () => initialState)
      .addCase(connectionLost, () => initialState)
  },
})

export const { resetMeeting, meetingStarted, chatReceived, voteCast, voteResults, clearMeetingError } = meetingSlice.actions
export default meetingSlice.reducer
