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

  /** Fallback hold-to-complete task duration (Spec §6.4). */
  holdTaskMs: 4_000,

  chatMaxLength: 140,
  chatMinIntervalMs: 750,

  newsTickerMs: 5_000,
} as const

export const TILE_SIZE = 32
export const ROOM_CODE_LENGTH = 5
