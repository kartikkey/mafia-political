/** Client-only tuning. Gameplay rules live in @netagiri/shared. */
export const MOVE_EMIT_INTERVAL_MS = 50 // 20 Hz position sync
export const AVATAR_COUNT = 8
export const STORAGE_KEYS = { name: 'netagiri.name', avatar: 'netagiri.avatar', muted: 'netagiri.muted' } as const
/** Sprite animation frame length. */
export const ANIM_FRAME_MS = 150
/** Camera zoom steps (multiples of "whole map fits"), cycled with Z. First is the default. */
export const ZOOM_LEVELS = [2, 1.4, 1] as const
/** Camera follow smoothing per frame (0–1). */
export const CAMERA_LERP = 0.18
