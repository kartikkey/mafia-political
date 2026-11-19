/**
 * Socket.IO event contracts — Gameplay Spec §10.3.
 * Client → server events use acknowledgements (`ack`) so the client can show
 * concise rejection reasons ("Too far away", "Cooldown: 8s", ...).
 */
import type {
  Body,
  ClientMatchView,
  Direction,
  Faction,
  PlayerMatchStats,
  PublicPlayer,
  SabotageType,
  Vec2,
  VictoryResult,
  VoteChoice,
  VoteTally,
} from './game'
import type { NewsKey } from '../constants/news'

export type Ack<T = undefined> = (res: AckResult<T>) => void
export type AckResult<T = undefined> = { ok: true; data: T } | { ok: false; reason: string }

export interface LobbyView {
  roomCode: string
  hostId: string
  players: PublicPlayer[]
  minPlayers: number
  maxPlayers: number
}

export interface RoleAssignment {
  faction: Faction
  /** Only non-empty for Deep State players. */
  teammateIds: string[]
}

export interface ChatMessage {
  id: string
  playerId: string
  text: string
  at: number
  /** Ghost whisper: only eliminated players receive these. */
  ghost?: boolean
}

/** Body-report replay: living positions near the body over the last few seconds. */
export interface MeetingReplay {
  center: Vec2
  radius: number
  frameMs: number
  bodyPlayerId: string
  frames: { players: { id: string; x: number; y: number }[] }[]
}

/** Meeting clue (Document Leak): who was last seen at the leaked station. */
export interface LeakClue {
  taskId: string
  stationLabel: string
  playerId: string
}

export interface GameOverPayload {
  result: Exclude<VictoryResult, 'NO_WINNER'>
  stats: PlayerMatchStats[]
}

export interface ClientToServerEvents {
  CREATE_ROOM: (p: { name: string; avatar: number }, ack: Ack<{ roomCode: string; playerId: string }>) => void
  JOIN_ROOM: (p: { roomCode: string; name: string; avatar: number }, ack: Ack<{ roomCode: string; playerId: string }>) => void
  LEAVE_ROOM: () => void
  SET_AVATAR: (p: { avatar: number }, ack: Ack) => void
  START_GAME: (ack: Ack) => void

  PLAYER_MOVED: (p: { position: Vec2; facing: Direction }) => void

  TASK_OPENED: (p: { taskId: string }, ack: Ack<{ puzzle: unknown }>) => void
  TASK_COMPLETED: (p: { taskId: string; payload: unknown }, ack: Ack) => void
  /** Player dismissed a mini-game without finishing (clears their interact animation). */
  TASK_CLOSED: () => void

  SABOTAGE_REQUEST: (p: { type: SabotageType; targetTaskId?: string }, ack: Ack) => void
  PLAYER_ELIMINATE_REQUEST: (p: { targetId: string }, ack: Ack) => void

  BODY_REPORTED: (p: { bodyId: string }, ack: Ack) => void
  EMERGENCY_MEETING: (ack: Ack) => void

  CHAT_SEND: (p: { text: string }, ack: Ack) => void
  VOTE_SUBMITTED: (p: { choice: VoteChoice }, ack: Ack) => void

  RETURN_TO_LOBBY: (ack: Ack) => void
  /** Clock sync: client estimates server-time offset from round trips. */
  TIME_SYNC: (ack: Ack<{ serverNow: number }>) => void
  /** Host: fill empty seats with computer players up to the minimum. */
  ADD_BOTS: (ack: Ack) => void
  REMOVE_BOTS: (ack: Ack) => void
}

export interface ServerToClientEvents {
  LOBBY_UPDATED: (lobby: LobbyView) => void
  PLAYER_JOINED: (player: PublicPlayer) => void
  PLAYER_LEFT: (p: { playerId: string }) => void
  ROOM_CLOSED: (p: { reason: string }) => void

  GAME_STARTED: (view: ClientMatchView) => void
  ROLE_ASSIGNED: (role: RoleAssignment) => void

  MATCH_STATE: (view: ClientMatchView) => void
  PLAYER_MOVED: (p: { playerId: string; position: Vec2; facing: Direction }) => void

  TASK_PROGRESS: (p: { taskId: string; completedTasks: number; totalTasks: number }) => void
  PLAYER_ELIMINATED: (p: { body: Body; livingCount: number }) => void
  COOLDOWN: (p: { eliminationReadyAt: number; sabotageReadyAt: number }) => void
  /** Someone started/stopped working a station. Same signal for real and fake (Deep State) tasks. */
  PLAYER_INTERACTING: (p: { playerId: string; taskId: string | null }) => void

  MEETING_STARTED: (p: { reason: 'BODY' | 'EMERGENCY'; callerId: string; bodyId?: string; phaseEndsAt: number; clue?: LeakClue; replay?: MeetingReplay }) => void
  CHAT_MESSAGE: (m: ChatMessage) => void
  VOTE_CAST: (p: { voterId: string }) => void
  VOTE_RESULTS: (t: VoteTally) => void

  NEWS: (p: { key: NewsKey; at: number }) => void
  GAME_OVER: (p: GameOverPayload) => void
}
