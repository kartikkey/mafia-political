/** Client-only tuning. Gameplay rules live in @netagiri/shared. */
export const MOVE_EMIT_INTERVAL_MS = 50 // 20 Hz position sync
export const AVATAR_COUNT = 8
export const STORAGE_KEYS = { name: 'netagiri.name', avatar: 'netagiri.avatar' } as const
