import { createAsyncThunk } from '@reduxjs/toolkit'
import type { Direction, SabotageType, Vec2 } from '@netagiri/shared'
import { emitWithAck, gameSocket } from 'api/gameSocket'
import { playSound } from 'helpers/sound'

/** Fire-and-forget position sync (throttled by the caller). */
export const sendMove = createAsyncThunk('game/sendMove', async (p: { position: Vec2; facing: Direction }) => {
  gameSocket.emit('PLAYER_MOVED', p)
})

const withReason = <A, R>(type: string, fn: (arg: A) => Promise<R>) =>
  createAsyncThunk(type, async (arg: A, { rejectWithValue }) => {
    try {
      return await fn(arg)
    } catch (e: any) {
      playSound('error')
      return rejectWithValue(e.message ?? 'Action rejected')
    }
  })

// Prompt 3/4 — tasks
export const openTask = withReason('game/openTask', (taskId: string) => emitWithAck('TASK_OPENED', { taskId }))
export const completeTask = withReason('game/completeTask', async (p: { taskId: string; payload: unknown }) => {
  await emitWithAck('TASK_COMPLETED', p)
  playSound('success')
})

// Prompt 5 — Deep State
export const eliminatePlayer = withReason('game/eliminate', (targetId: string) => emitWithAck('PLAYER_ELIMINATE_REQUEST', { targetId }))
export const sabotage = withReason('game/sabotage', (p: { type: SabotageType; targetTaskId?: string }) => emitWithAck('SABOTAGE_REQUEST', p))

// Prompt 6 — meetings
export const reportBody = withReason('game/reportBody', (bodyId: string) => emitWithAck('BODY_REPORTED', { bodyId }))
export const callEmergencyMeeting = withReason('game/emergency', (_: void) => emitWithAck('EMERGENCY_MEETING'))
