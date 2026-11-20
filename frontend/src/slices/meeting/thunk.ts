import { createAsyncThunk } from '@reduxjs/toolkit'
import type { VoteChoice } from '@netagiri/shared'
import { emitWithAck } from 'api/gameSocket'

export const submitVote = createAsyncThunk('meeting/submitVote', async (choice: VoteChoice, { rejectWithValue }) => {
  try {
    await emitWithAck('VOTE_SUBMITTED', { choice })
    return choice
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Vote rejected')
  }
})

export const sendChat = createAsyncThunk('meeting/sendChat', async (text: string, { rejectWithValue }) => {
  try {
    await emitWithAck('CHAT_SEND', { text })
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Message rejected')
  }
})
