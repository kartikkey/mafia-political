import { createAsyncThunk } from '@reduxjs/toolkit'
import { emitWithAck } from 'api/gameSocket'

export const returnToLobby = createAsyncThunk('results/returnToLobby', async (_: void, { rejectWithValue }) => {
  try {
    await emitWithAck('RETURN_TO_LOBBY')
  } catch (e: any) {
    return rejectWithValue(e.message ?? 'Could not return to lobby')
  }
})
