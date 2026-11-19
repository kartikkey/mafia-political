/**
 * Match defaults — Gameplay Spec §2.4, §7, §8.3.
 * All durations are milliseconds. The server owns these values; the client
 * only uses them to render local countdowns from server timestamps.
 */
export const MATCH_SETTINGS = {
  minPlayers: 6,
  maxPlayers: 10,

  /** World units per second. Same for every player (Spec §1.2). */
  moveSpeed: 160,

  eliminationCooldownMs: 25_000,
  /** Grace period after the match starts before any elimination (players leave spawn). */
  initialEliminationCooldownMs: 12_000,
  /** Elimination radius in world pixels (~1 tile). */
  eliminationRange: 40,
  /** Shared interaction radius for tasks, bodies, sabotage objects. */
  interactionRange: 48,
  reportRange: 56,

  roleRevealMs: 4_000,
  meetingTransitionMs: 2_000,
  discussionMs: 40_000,
  votingMs: 20_000,
  voteResultsMs: 4_000,
  resumeMs: 2_000,

  /** Global emergency-button cooldown (Spec §8.2: global is simplest). */
  emergencyMeetingCooldownMs: 60_000,

  powerCutDurationMs: 15_000,
  sabotageCooldownMs: 30_000,
  /** Document Leak: one task station offline for this long. */
  documentLeakDurationMs: 20_000,

  /** Fallback hold-to-complete task duration (Spec §6.4). */
  holdTaskMs: 4_000,
  /** Network jitter allowance when checking a hold duration. */
  holdToleranceMs: 300,

  /** Approve the Bill: sequence length and how long it is shown (Spec §6.3). */
  billSequenceLength: 3,
  billShowMs: 2_500,

  /** Per-socket minimum gap between consequential action requests (Spec §12.1). */
  actionRateLimitMs: 200,

  chatMaxLength: 140,
  chatMinIntervalMs: 750,

  newsTickerMs: 5_000,

  /** Client feedback line lifetime ("Too far away", "Cooldown: 8s"). */
  feedbackMs: 2_000,
} as const

/** Per-type switch: false falls back to HOLD-to-complete (Spec §6.4). */
export const MINIGAME_ENABLED = {
  FILE_SORT: true,
  RESTORE_POWER: true,
  APPROVE_BILL: true,
  HOLD: true,
} as const

export const TILE_SIZE = 32
export const ROOM_CODE_LENGTH = 5
