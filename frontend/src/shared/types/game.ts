/** Core domain types shared by client and server. Spec §5.2, §9.1, §10. */

export type Faction = 'GOVERNMENT' | 'DEEP_STATE'

/** Match state machine — Gameplay Spec §9.1. */
export type MatchState =
  | 'WAITING'
  | 'ROLE_ASSIGNMENT'
  | 'PLAYING'
  | 'MEETING_TRANSITION'
  | 'DISCUSSION'
  | 'VOTING'
  | 'VOTE_RESULTS'
  | 'GAME_OVER'

export type RoomId = 'LOK_SABHA' | 'PM_OFFICE' | 'FINANCE_MINISTRY' | 'RECORDS_ROOM' | 'CENTRAL_HALL'

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Vec2 {
  x: number
  y: number
}

/** Public player info — safe to broadcast. Never contains faction while alive. */
export interface PublicPlayer {
  id: string
  name: string
  avatar: number
  isHost: boolean
  connected: boolean
  alive: boolean
  position: Vec2
  facing: Direction
  /** Only populated after the player is ejected/eliminated or at GAME_OVER. */
  revealedFaction?: Faction
  /** Computer-controlled filler player. */
  isBot?: boolean
  /** Dropped mid-match; seat held for the rejoin grace period. */
  reconnecting?: boolean
}

export type TaskType = 'FILE_SORT' | 'RESTORE_POWER' | 'APPROVE_BILL' | 'HOLD'
export type TaskStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETE' | 'DISABLED'

export interface TaskInstance {
  taskId: string
  type: TaskType
  label: string
  roomId: RoomId
  position: Vec2
  status: TaskStatus
  assignedTo: string | null
}

export interface Body {
  bodyId: string
  playerId: string
  position: Vec2
  roomId: RoomId | null
  reported: boolean
}

export type SabotageType = 'POWER_CUT' | 'DOCUMENT_LEAK'

export interface SabotageState {
  powerStatus: 'ON' | 'OUT'
  powerRestoreAt: number | null
  disabledTaskIds: string[]
  /** Document Leak: when the disabled station comes back online. */
  leakEndsAt?: number | null
}

export type VictoryResult = 'GOVERNMENT_WINS' | 'DEEP_STATE_WINS' | 'NO_WINNER'

export type VoteChoice = string | 'SKIP'

export interface VoteTally {
  counts: Record<VoteChoice, number>
  ejectedPlayerId: string | null
  ejectedFaction: Faction | null
}

export interface PlayerMatchStats {
  playerId: string
  faction: Faction
  tasksCompleted: number
  eliminations: number
  meetingsAttended: number
  alive: boolean
  /** Removed by vote (vs eliminated by an agent). */
  ejected?: boolean
  /** Deep State "cover" tasks finished (never count as progress). */
  fakeTasks?: number
  reports?: number
  powerRepairs?: number
  /** Votes cast for a Deep State agent. */
  votesOnAgents?: number
}

/** The slice of match state each client is allowed to see. */
export interface ClientMatchView {
  roomCode: string
  state: MatchState
  /** Server timestamp at which the current phase ends (null if untimed). */
  phaseEndsAt: number | null
  players: PublicPlayer[]
  tasks: TaskInstance[]
  completedTasks: number
  totalTasks: number
  bodies: Body[]
  sabotage: SabotageState
  emergencyAvailableAt: number
}
