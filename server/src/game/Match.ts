/**
 * Authoritative match state for one room — Gameplay Spec §9, §10.2.
 * Pure state + validation; broadcasting lives in handlers/ and game/flow.ts.
 * Every action method returns a human-readable rejection reason (string) or
 * a success value. A rejected action never consumes a cooldown.
 */
import {
  MATCH_SETTINGS,
  POWER_PANEL,
  REPAIR_TASK_ID,
  SPAWN_POINTS,
  TASK_STATIONS,
  assignRoles,
  checkVictory,
  isWalkable,
  roomAt,
  tallyVotes,
  withinRange,
  type Body,
  type ClientMatchView,
  type Direction,
  type Faction,
  type MatchState,
  type PlayerMatchStats,
  type PublicPlayer,
  type SabotageState,
  type SabotageType,
  type TaskInstance,
  type TaskPuzzle,
  type Vec2,
  type VictoryResult,
  type VoteChoice,
  type VoteTally,
} from '@netagiri/shared'
import { checkAnswer, generatePuzzle, type GeneratedPuzzle } from './puzzles'

export interface OpenTask {
  taskId: string
  openedAt: number
  answer: GeneratedPuzzle['answer']
  /** Deep State "fake" interaction — never changes task state (Spec §7.3). */
  fake: boolean
}

export interface ServerPlayer extends PublicPlayer {
  socketId: string
  faction: Faction | null
  lastMoveAt: number
  lastActionAt: number
  lastChatAt: number
  eliminationReadyAt: number
  openTask: OpenTask | null
  stats: { tasksCompleted: number; eliminations: number; meetingsAttended: number }
  ejected?: boolean
}

export interface MeetingInfo {
  reason: 'BODY' | 'EMERGENCY'
  callerId: string
  bodyId?: string
}

const IN_MATCH: MatchState[] = ['ROLE_ASSIGNMENT', 'PLAYING', 'MEETING_TRANSITION', 'DISCUSSION', 'VOTING', 'VOTE_RESULTS']
const secs = (ms: number) => Math.max(1, Math.ceil(ms / 1000))
const freshStats = () => ({ tasksCompleted: 0, eliminations: 0, meetingsAttended: 0 })
const powerOn = (): SabotageState => ({ powerStatus: 'ON', powerRestoreAt: null, disabledTaskIds: [], leakEndsAt: null })

export class Match {
  state: MatchState = 'WAITING'
  phaseEndsAt: number | null = null
  players = new Map<string, ServerPlayer>()
  tasks: TaskInstance[] = []
  bodies: Body[] = []
  sabotage: SabotageState = powerOn()
  /** Team-wide Deep State sabotage cooldown. */
  sabotageReadyAt = 0
  emergencyAvailableAt = 0
  votes = new Map<string, VoteChoice>()
  meeting: MeetingInfo | null = null
  lastTally: VoteTally | null = null
  result: Exclude<VictoryResult, 'NO_WINNER'> | null = null
  private timer: NodeJS.Timeout | null = null
  /** Separate from the phase timer so meetings can't wipe or double-fire it. */
  private sabotageTimer: NodeJS.Timeout | null = null
  private bodySeq = 0

  constructor(public readonly roomCode: string) {}

  /** Wired by the handlers: timer-driven phase end + timed power restore. */
  onPhaseEnd: (state: MatchState) => void = () => {}
  onSabotageEnded: (type: SabotageType) => void = () => {}

  get hostId(): string | undefined {
    return [...this.players.values()].find((p) => p.isHost)?.id
  }

  get connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected)
  }

  get inMatch() {
    return IN_MATCH.includes(this.state)
  }

  /** Living + connected players — the only ones that count, vote or chat. */
  get livingPlayers() {
    return [...this.players.values()].filter((p) => p.alive && p.connected)
  }

  publicPlayers(): PublicPlayer[] {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      connected: p.connected,
      alive: p.alive,
      position: p.position,
      facing: p.facing,
      // Faction is revealed only for dead players or once the match is over (Spec §2.3).
      revealedFaction: this.state === 'GAME_OVER' || !p.alive ? (p.faction ?? undefined) : undefined,
    }))
  }

  view(): ClientMatchView {
    return {
      roomCode: this.roomCode,
      state: this.state,
      phaseEndsAt: this.phaseEndsAt,
      players: this.publicPlayers(),
      tasks: this.tasks,
      completedTasks: this.completedTasks,
      totalTasks: this.tasks.length,
      bodies: this.bodies,
      sabotage: this.sabotage,
      emergencyAvailableAt: this.emergencyAvailableAt,
    }
  }

  get completedTasks() {
    return this.tasks.filter((t) => t.status === 'COMPLETE').length
  }

  /** Host-only start. Returns a rejection reason or null on success. */
  start(requesterId: string): string | null {
    if (this.state !== 'WAITING') return 'Match already started'
    if (requesterId !== this.hostId) return 'Only the host can start the match'
    const ids = this.connectedPlayers.map((p) => p.id)
    if (ids.length < MATCH_SETTINGS.minPlayers) return `Need at least ${MATCH_SETTINGS.minPlayers} players`
    if (ids.length > MATCH_SETTINGS.maxPlayers) return `At most ${MATCH_SETTINGS.maxPlayers} players`
    if (TASK_STATIONS.length === 0) return 'Task list is empty' // Spec §12

    const roles = assignRoles(ids)
    ids.forEach((id, i) => {
      const p = this.players.get(id)!
      p.faction = roles[id]
      p.alive = true
      p.position = { ...SPAWN_POINTS[i % SPAWN_POINTS.length] }
      p.eliminationReadyAt = 0
      p.openTask = null
      p.stats = freshStats()
      p.ejected = false
    })

    this.tasks = TASK_STATIONS.map((s) => ({
      taskId: s.stationId,
      type: s.type,
      label: s.label,
      roomId: s.roomId,
      position: s.position,
      status: 'AVAILABLE',
      assignedTo: null,
    }))
    this.bodies = []
    this.votes.clear()
    this.meeting = null
    this.lastTally = null
    this.result = null
    this.sabotageReadyAt = 0
    this.emergencyAvailableAt = 0
    this.clearSabotage()
    this.setState('ROLE_ASSIGNMENT', MATCH_SETTINGS.roleRevealMs)
    return null
  }

  /** Teammates visible to a given player — only Deep State see anyone. */
  teammatesOf(playerId: string): string[] {
    const me = this.players.get(playerId)
    if (me?.faction !== 'DEEP_STATE') return []
    return [...this.players.values()].filter((p) => p.faction === 'DEEP_STATE' && p.id !== playerId).map((p) => p.id)
  }

  /** Validate and apply a movement update (Spec §3.3). Returns true if accepted. */
  move(playerId: string, position: Vec2, facing: Direction, now = Date.now()): boolean {
    const p = this.players.get(playerId)
    if (!p || !p.alive || this.state !== 'PLAYING') return false
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return false
    if (!isWalkable(position)) return false
    const dt = Math.max(16, now - p.lastMoveAt)
    const maxStep = (MATCH_SETTINGS.moveSpeed * dt) / 1000 + 8 // tolerance for jitter
    if (Math.hypot(position.x - p.position.x, position.y - p.position.y) > maxStep) return false
    p.position = position
    p.facing = facing
    p.lastMoveAt = now
    return true
  }

  /** Shared guard chain (CLAUDE.md rule 3): exists → alive → PLAYING → rate limit. */
  private actor(playerId: string, now: number): ServerPlayer | string {
    const p = this.players.get(playerId)
    if (!p || !p.connected) return 'Not in this match'
    if (!p.alive) return 'You have been eliminated'
    if (this.state === 'GAME_OVER') return 'Match is over'
    if (this.state !== 'PLAYING') return 'Meeting in progress'
    if (now - p.lastActionAt < MATCH_SETTINGS.actionRateLimitMs) return 'Slow down'
    p.lastActionAt = now
    return p
  }

  // ── Tasks (Spec §5, §6) ────────────────────────────────────────────────

  openTask(playerId: string, taskId: string, now = Date.now()): { puzzle: TaskPuzzle } | string {
    const p = this.actor(playerId, now)
    if (typeof p === 'string') return p

    if (taskId === REPAIR_TASK_ID) {
      if (!withinRange(p.position, POWER_PANEL, MATCH_SETTINGS.interactionRange)) return 'Too far away'
      if (this.sabotage.powerStatus !== 'OUT') return 'Power is already on'
      const gen = generatePuzzle('RESTORE_POWER')
      p.openTask = { taskId, openedAt: now, answer: gen.answer, fake: p.faction !== 'GOVERNMENT' }
      return { puzzle: gen.puzzle }
    }

    const task = this.tasks.find((t) => t.taskId === taskId)
    if (!task) return 'Task unavailable'
    if (!withinRange(p.position, task.position, MATCH_SETTINGS.interactionRange)) return 'Too far away'
    if (task.status === 'COMPLETE') return 'Task already complete'
    if (this.sabotage.disabledTaskIds.includes(taskId)) return `Documents leaked — back in ${secs((this.sabotage.leakEndsAt ?? now) - now)}s`

    const gen = generatePuzzle(task.type)
    p.openTask = { taskId, openedAt: now, answer: gen.answer, fake: p.faction !== 'GOVERNMENT' }
    return { puzzle: gen.puzzle }
  }

  closeTask(playerId: string) {
    const p = this.players.get(playerId)
    if (p) p.openTask = null
  }

  /**
   * Submit a task answer. `progressed` is true only for a real Government
   * completion; `restored` when it ended a Power Cut.
   */
  completeTask(playerId: string, taskId: string, payload: unknown, now = Date.now()): { progressed: boolean; restored: boolean } | string {
    const p = this.actor(playerId, now)
    if (typeof p === 'string') return p
    const open = p.openTask
    if (!open || open.taskId !== taskId) return 'Open the task first'

    const isRepair = taskId === REPAIR_TASK_ID
    const task = this.tasks.find((t) => t.taskId === taskId)
    if (!isRepair && !task) return 'Task unavailable'
    const at = isRepair ? POWER_PANEL : task!.position
    if (!withinRange(p.position, at, MATCH_SETTINGS.interactionRange)) return 'Too far away'
    if (task?.status === 'COMPLETE') {
      p.openTask = null
      return 'Task already complete'
    }
    if (isRepair && this.sabotage.powerStatus !== 'OUT') {
      p.openTask = null
      return 'Power is already on'
    }

    const valid =
      open.answer === null ? now - open.openedAt >= MATCH_SETTINGS.holdTaskMs - MATCH_SETTINGS.holdToleranceMs : checkAnswer(open.answer, payload)
    if (!valid) return open.answer === null ? 'Keep holding' : 'Incorrect — try again'

    p.openTask = null
    if (open.fake) return { progressed: false, restored: false } // Spec §2.3: Deep State never adds progress

    let restored = false
    if (isRepair || (task!.type === 'RESTORE_POWER' && this.sabotage.powerStatus === 'OUT')) {
      this.clearSabotage()
      restored = true
    }
    if (isRepair) return { progressed: false, restored }

    task!.status = 'COMPLETE'
    p.stats.tasksCompleted++
    return { progressed: true, restored }
  }

  // ── Deep State actions (Spec §7) ─────────────────────────────────────

  eliminate(actorId: string, targetId: string, now = Date.now()): Body | string {
    const p = this.actor(actorId, now)
    if (typeof p === 'string') return p
    if (p.faction !== 'DEEP_STATE') return 'Not allowed'
    const target = this.players.get(targetId)
    if (!target || !target.connected) return 'No target'
    if (!target.alive) return 'Target already eliminated'
    if (target.faction !== 'GOVERNMENT') return 'Cannot eliminate a teammate'
    if (!withinRange(p.position, target.position, MATCH_SETTINGS.eliminationRange)) return 'Too far away'
    if (now < p.eliminationReadyAt) return `Cooldown: ${secs(p.eliminationReadyAt - now)}s`

    target.alive = false
    target.openTask = null
    p.eliminationReadyAt = now + MATCH_SETTINGS.eliminationCooldownMs
    p.stats.eliminations++
    const body: Body = {
      bodyId: `b${++this.bodySeq}`,
      playerId: target.id,
      position: { ...target.position },
      roomId: roomAt(target.position),
      reported: false,
    }
    this.bodies.push(body)
    return body
  }

  /**
   * One sabotage at a time (team-wide cooldown).
   * POWER_CUT at the power panel; DOCUMENT_LEAK at an available task station
   * (that station goes offline). Returns the ids of players whose open task was
   * closed by the leak, or a rejection reason.
   */
  sabotageAction(actorId: string, type: SabotageType, targetTaskId?: string, now = Date.now()): { closedFor: string[] } | string {
    const p = this.actor(actorId, now)
    if (typeof p === 'string') return p
    if (p.faction !== 'DEEP_STATE') return 'Not allowed'
    if (type !== 'POWER_CUT' && type !== 'DOCUMENT_LEAK') return 'Sabotage unavailable'

    let leakTask: TaskInstance | undefined
    if (type === 'POWER_CUT') {
      if (!withinRange(p.position, POWER_PANEL, MATCH_SETTINGS.interactionRange)) return 'Too far away'
      if (this.sabotage.powerStatus === 'OUT') return 'Power is already out'
    } else {
      leakTask = this.tasks.find((t) => t.taskId === targetTaskId)
      if (!leakTask) return 'Stand at a task station'
      if (!withinRange(p.position, leakTask.position, MATCH_SETTINGS.interactionRange)) return 'Too far away'
      if (leakTask.status === 'COMPLETE') return 'Task already complete'
    }
    if (this.sabotageActive) return 'Sabotage already active'
    if (now < this.sabotageReadyAt) return `Cooldown: ${secs(this.sabotageReadyAt - now)}s`

    this.sabotageReadyAt = now + MATCH_SETTINGS.sabotageCooldownMs
    const closedFor: string[] = []
    let duration: number
    if (type === 'POWER_CUT') {
      duration = MATCH_SETTINGS.powerCutDurationMs
      this.sabotage = { powerStatus: 'OUT', powerRestoreAt: now + duration, disabledTaskIds: [], leakEndsAt: null }
    } else {
      duration = MATCH_SETTINGS.documentLeakDurationMs
      this.sabotage = { powerStatus: 'ON', powerRestoreAt: null, disabledTaskIds: [leakTask!.taskId], leakEndsAt: now + duration }
      for (const pl of this.players.values()) {
        if (pl.openTask?.taskId === leakTask!.taskId) {
          pl.openTask = null
          closedFor.push(pl.id)
        }
      }
    }
    this.sabotageTimer = setTimeout(() => {
      this.sabotageTimer = null
      if (!this.sabotageActive) return
      this.sabotage = powerOn()
      this.onSabotageEnded(type)
    }, duration)
    return { closedFor }
  }

  get sabotageActive() {
    return this.sabotage.powerStatus === 'OUT' || this.sabotage.disabledTaskIds.length > 0
  }

  /** Ends any active sabotage (repair, meeting, game over, reset). */
  clearSabotage() {
    if (this.sabotageTimer) clearTimeout(this.sabotageTimer)
    this.sabotageTimer = null
    this.sabotage = powerOn()
  }

  /** ROLE_ASSIGNMENT → PLAYING: agents get a grace period before the first elimination. */
  beginPlay(now = Date.now()) {
    for (const p of this.players.values()) {
      if (p.faction === 'DEEP_STATE') p.eliminationReadyAt = now + MATCH_SETTINGS.initialEliminationCooldownMs
    }
    this.setState('PLAYING')
  }

  // ── Meetings & voting (Spec §8) ──────────────────────────────────────

  report(playerId: string, bodyId: string, now = Date.now()): string | null {
    const p = this.actor(playerId, now)
    if (typeof p === 'string') return p
    const body = this.bodies.find((b) => b.bodyId === bodyId)
    if (!body) return 'Nothing to report'
    if (body.reported) return 'Already reported'
    if (!withinRange(p.position, body.position, MATCH_SETTINGS.reportRange)) return 'Too far away'
    body.reported = true
    this.beginMeeting({ reason: 'BODY', callerId: p.id, bodyId })
    return null
  }

  callEmergency(playerId: string, now = Date.now()): string | null {
    const p = this.actor(playerId, now)
    if (typeof p === 'string') return p
    if (now < this.emergencyAvailableAt) return `Cooldown: ${secs(this.emergencyAvailableAt - now)}s`
    this.beginMeeting({ reason: 'EMERGENCY', callerId: p.id })
    return null
  }

  private beginMeeting(info: MeetingInfo) {
    this.meeting = info
    this.votes.clear()
    this.lastTally = null
    this.clearSabotage()
    for (const b of this.bodies) b.reported = true
    for (const p of this.players.values()) {
      p.openTask = null // Spec §5.3: task UI closes when a meeting starts
      if (p.alive && p.connected) p.stats.meetingsAttended++
    }
    this.setState('MEETING_TRANSITION', MATCH_SETTINGS.meetingTransitionMs)
  }

  vote(voterId: string, choice: VoteChoice): { allVoted: boolean } | string {
    const p = this.players.get(voterId)
    if (!p || !p.connected) return 'Not in this match'
    if (!p.alive) return 'Eliminated players cannot vote'
    if (this.state !== 'VOTING') return 'Voting is not open'
    if (this.votes.has(voterId)) return 'Vote already cast'
    if (choice !== 'SKIP') {
      if (choice === voterId) return 'You cannot vote for yourself'
      const target = this.players.get(choice)
      if (!target || !target.alive || !target.connected) return 'Invalid vote'
    }
    this.votes.set(voterId, choice)
    return { allVoted: this.allVoted() }
  }

  allVoted() {
    const eligible = this.livingPlayers
    return eligible.length > 0 && eligible.every((p) => this.votes.has(p.id))
  }

  /** Spec §8.4, §8.6: tally submitted votes (incl. from since-disconnected voters). */
  resolveVotes(): VoteTally {
    const { counts, ejectedPlayerId } = tallyVotes(Object.fromEntries(this.votes))
    let ejectedFaction: Faction | null = null
    if (ejectedPlayerId) {
      const ej = this.players.get(ejectedPlayerId)!
      ej.alive = false
      ej.ejected = true
      ejectedFaction = ej.faction
    }
    this.lastTally = { counts, ejectedPlayerId, ejectedFaction }
    this.setState('VOTE_RESULTS', MATCH_SETTINGS.voteResultsMs)
    return this.lastTally
  }

  resumePlay(now = Date.now()) {
    let i = 0
    for (const p of this.players.values()) {
      p.position = { ...SPAWN_POINTS[i++ % SPAWN_POINTS.length] }
      p.lastMoveAt = now
    }
    this.bodies = []
    this.votes.clear()
    this.meeting = null
    this.emergencyAvailableAt = now + MATCH_SETTINGS.emergencyMeetingCooldownMs
    this.setState('PLAYING')
  }

  // ── Victory & lifecycle (Spec §9) ────────────────────────────────────

  checkVictory(): VictoryResult {
    return checkVictory({
      players: [...this.players.values()].filter((p) => p.faction).map((p) => ({ faction: p.faction!, alive: p.alive, connected: p.connected })),
      completedTasks: this.completedTasks,
      totalTasks: this.tasks.length,
    })
  }

  /** Ends the match if a side has won. Returns the result or null. */
  finishIfWon(): Exclude<VictoryResult, 'NO_WINNER'> | null {
    if (!this.inMatch) return null
    const result = this.checkVictory()
    if (result === 'NO_WINNER') return null
    this.result = result
    this.clearSabotage()
    for (const p of this.players.values()) p.openTask = null
    this.setState('GAME_OVER')
    return result
  }

  matchStats(): PlayerMatchStats[] {
    return [...this.players.values()]
      .filter((p) => p.faction)
      .map((p) => ({ playerId: p.id, faction: p.faction!, ...p.stats, alive: p.alive && p.connected, ejected: !!p.ejected }))
  }

  /** Mid-match disconnect (Spec §12): no longer counts; open task reset. */
  markDisconnected(playerId: string) {
    const p = this.players.get(playerId)
    if (!p) return
    p.connected = false
    p.openTask = null
  }

  setState(state: MatchState, durationMs?: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.state = state
    this.phaseEndsAt = durationMs ? Date.now() + durationMs : null
    if (durationMs) this.timer = setTimeout(() => this.onPhaseEnd(state), durationMs)
  }

  resetToLobby() {
    this.setState('WAITING')
    this.clearSabotage()
    this.tasks = []
    this.bodies = []
    this.votes.clear()
    this.meeting = null
    this.lastTally = null
    this.result = null
    for (const p of this.players.values()) {
      p.faction = null
      p.alive = true
      p.openTask = null
      p.eliminationReadyAt = 0
      p.stats = freshStats()
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer)
    this.clearSabotage()
  }
}

