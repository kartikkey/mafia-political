/**
 * Authoritative match state for one room — Gameplay Spec §9, §10.2.
 *
 * Phase 1 (implemented): WAITING → ROLE_ASSIGNMENT → PLAYING, private role
 * delivery, movement validation.
 * Later phases (see docs/PROJECT_PLAN.md prompts 3–8) add tasks, elimination,
 * sabotage, meetings, voting and GAME_OVER on top of this class.
 */
import {
  MATCH_SETTINGS,
  SPAWN_POINTS,
  TASK_STATIONS,
  assignRoles,
  checkVictory,
  isWalkable,
  type Body,
  type ClientMatchView,
  type Direction,
  type Faction,
  type MatchState,
  type PublicPlayer,
  type SabotageState,
  type TaskInstance,
  type Vec2,
  type VictoryResult,
} from '@netagiri/shared'

export interface ServerPlayer extends PublicPlayer {
  socketId: string
  faction: Faction | null
  lastMoveAt: number
}

export class Match {
  state: MatchState = 'WAITING'
  phaseEndsAt: number | null = null
  players = new Map<string, ServerPlayer>()
  tasks: TaskInstance[] = []
  bodies: Body[] = []
  sabotage: SabotageState = { powerStatus: 'ON', powerRestoreAt: null, disabledTaskIds: [] }
  emergencyAvailableAt = 0
  private timer: NodeJS.Timeout | null = null

  constructor(public readonly roomCode: string) {}

  get hostId(): string | undefined {
    return [...this.players.values()].find((p) => p.isHost)?.id
  }

  get connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected)
  }

  publicPlayers(): PublicPlayer[] {
    return [...this.players.values()].map(({ socketId: _s, faction, lastMoveAt: _m, ...pub }) => ({
      ...pub,
      // Faction is revealed only for dead players or once the match is over (Spec §2.3).
      revealedFaction: this.state === 'GAME_OVER' || !pub.alive ? (faction ?? undefined) : undefined,
    }))
  }

  view(): ClientMatchView {
    return {
      roomCode: this.roomCode,
      state: this.state,
      phaseEndsAt: this.phaseEndsAt,
      players: this.publicPlayers(),
      tasks: this.tasks,
      completedTasks: this.tasks.filter((t) => t.status === 'COMPLETE').length,
      totalTasks: this.tasks.length,
      bodies: this.bodies,
      sabotage: this.sabotage,
      emergencyAvailableAt: this.emergencyAvailableAt,
    }
  }

  /** Host-only start. Returns a rejection reason or null on success. */
  start(requesterId: string): string | null {
    if (this.state !== 'WAITING') return 'Match already started'
    if (requesterId !== this.hostId) return 'Only the host can start the match'
    const ids = this.connectedPlayers.map((p) => p.id)
    if (ids.length < MATCH_SETTINGS.minPlayers) return `Need at least ${MATCH_SETTINGS.minPlayers} players`
    if (ids.length > MATCH_SETTINGS.maxPlayers) return `At most ${MATCH_SETTINGS.maxPlayers} players`

    const roles = assignRoles(ids)
    ids.forEach((id, i) => {
      const p = this.players.get(id)!
      p.faction = roles[id]
      p.alive = true
      p.position = { ...SPAWN_POINTS[i % SPAWN_POINTS.length] }
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
    if (this.tasks.length === 0) return 'Task list is empty' // Spec §12

    this.bodies = []
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

  checkVictory(): VictoryResult {
    const view = this.view()
    return checkVictory({
      players: [...this.players.values()].filter((p) => p.faction).map((p) => ({ faction: p.faction!, alive: p.alive, connected: p.connected })),
      completedTasks: view.completedTasks,
      totalTasks: view.totalTasks,
    })
  }

  /** Transition helper; `onPhaseEnd` is wired by the room manager. */
  onPhaseEnd: (state: MatchState) => void = () => {}

  setState(state: MatchState, durationMs?: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.state = state
    this.phaseEndsAt = durationMs ? Date.now() + durationMs : null
    if (durationMs) this.timer = setTimeout(() => this.onPhaseEnd(state), durationMs)
  }

  resetToLobby() {
    this.setState('WAITING')
    this.tasks = []
    this.bodies = []
    this.sabotage = { powerStatus: 'ON', powerRestoreAt: null, disabledTaskIds: [] }
    for (const p of this.players.values()) {
      p.faction = null
      p.alive = true
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer)
  }
}
