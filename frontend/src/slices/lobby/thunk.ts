import { createAsyncThunk } from '@reduxjs/toolkit'
import { emitWithAck } from 'api/gameSocket'

export const startGame = createAsyncThunk('lobby/startGame', async (_: void, { rejectWithValue }) => {
  try {
    await emitWithAck('START_GAME')
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Failed to start')
  }
})

export const setAvatar = createAsyncThunk('lobby/setAvatar', async (avatar: number, { rejectWithValue }) => {
  try {
    await emitWithAck('SET_AVATAR', { avatar })
    return avatar
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Failed to change character')
  }
})

/** Host: fill empty seats with computer players (or remove them all). */
export const addBots = createAsyncThunk('lobby/addBots', async (_: void, { rejectWithValue }) => {
  try {
    await emitWithAck('ADD_BOTS')
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Could not add computer players')
  }
})

export const removeBot = createAsyncThunk('lobby/removeBot', async (playerId: string, { rejectWithValue }) => {
  try {
    await emitWithAck('REMOVE_BOT', { playerId })
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Could not remove computer player')
  }
})

export const removeBots = createAsyncThunk('lobby/removeBots', async (_: void, { rejectWithValue }) => {
  try {
    await emitWithAck('REMOVE_BOTS')
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Could not remove computer players')
  }
})

/** Host: remove a human player from the lobby (they may join again). */
export const kickPlayer = createAsyncThunk('lobby/kickPlayer', async (playerId: string, { rejectWithValue }) => {
  try {
    await emitWithAck('KICK_PLAYER', { playerId })
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Could not remove player')
  }
})
