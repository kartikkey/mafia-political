import type { Faction, VictoryResult } from '../types/game'

export interface VictoryInput {
  players: { faction: Faction; alive: boolean; connected: boolean }[]
  completedTasks: number
  totalTasks: number
}

/**
 * Gameplay Spec §9.2. Disconnected or dead players don't count as living.
 * A totalTasks of 0 never awards a task victory (Spec §12 edge case).
 */
export function checkVictory({ players, completedTasks, totalTasks }: VictoryInput): VictoryResult {
  const living = players.filter((p) => p.alive && p.connected)
  const livingGovernment = living.filter((p) => p.faction === 'GOVERNMENT').length
  const livingDeepState = living.filter((p) => p.faction === 'DEEP_STATE').length

  if (totalTasks > 0 && completedTasks >= totalTasks) return 'GOVERNMENT_WINS'
  if (livingDeepState === 0) return 'GOVERNMENT_WINS'
  if (livingDeepState >= livingGovernment) return 'DEEP_STATE_WINS'
  return 'NO_WINNER'
}
