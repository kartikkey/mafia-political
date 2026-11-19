/**
 * The Parliament map — Game Design §4. One connected tile grid shared by the
 * client (rendering) and the server (collision + range validation).
 *
 *   ┌──────────┐   ┌────────────┐   ┌──────────┐
 *   │ FINANCE  │===│ LOK SABHA  │===│ PM OFFICE│
 *   └────┬─────┘   └─────┬──────┘   └────┬─────┘
 *   ═════╪═══════ corridor ══════════════╪═════
 *   ┌────┴─────┐   ┌─────┴─────────────────┴──┐
 *   │ RECORDS  │   │      CENTRAL HALL        │
 *   └──────────┘   └──────────────────────────┘
 *
 * Tile values: 0 = floor, 1 = wall, 2 = solid furniture.
 */
import { TILE_SIZE } from '../constants/settings'
import type { RoomId, TaskType, Vec2 } from '../types/game'

export const MAP_COLS = 40
export const MAP_ROWS = 26
export const MAP_WIDTH = MAP_COLS * TILE_SIZE
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface MapRoom {
  id: RoomId
  label: string
  rect: Rect // in tiles
}

export const ROOMS: MapRoom[] = [
  { id: 'FINANCE_MINISTRY', label: 'Finance Ministry', rect: { x: 1, y: 1, w: 10, h: 9 } },
  { id: 'LOK_SABHA', label: 'Lok Sabha', rect: { x: 14, y: 1, w: 12, h: 11 } },
  { id: 'PM_OFFICE', label: "Prime Minister's Office", rect: { x: 29, y: 1, w: 10, h: 9 } },
  { id: 'RECORDS_ROOM', label: 'Records Room', rect: { x: 1, y: 15, w: 10, h: 10 } },
  { id: 'CENTRAL_HALL', label: 'Central Hall', rect: { x: 14, y: 15, w: 25, h: 10 } },
]

/** Corridors and doorways carved out of the wall mass. */
const PASSAGES: Rect[] = [
  { x: 1, y: 12, w: 38, h: 2 }, // main east–west corridor
  { x: 5, y: 10, w: 2, h: 2 }, // Finance ↓
  { x: 19, y: 12, w: 2, h: 1 }, // Lok Sabha ↓ (Lok Sabha already reaches row 11)
  { x: 33, y: 10, w: 2, h: 2 }, // PM Office ↓
  { x: 5, y: 14, w: 2, h: 1 }, // Records ↑
  { x: 19, y: 14, w: 2, h: 1 }, // Central Hall ↑ (west)
  { x: 33, y: 14, w: 2, h: 1 }, // Central Hall ↑ (east)
  { x: 11, y: 4, w: 3, h: 2 }, // Finance ↔ Lok Sabha
  { x: 26, y: 4, w: 3, h: 2 }, // Lok Sabha ↔ PM Office
]

/** Desks, benches, cabinets (solid). */
const FURNITURE: Rect[] = [
  { x: 19, y: 2, w: 2, h: 1 }, // Speaker's chair
  { x: 16, y: 5, w: 3, h: 1 }, // treasury benches
  { x: 21, y: 5, w: 3, h: 1 },
  { x: 16, y: 8, w: 3, h: 1 }, // opposition benches
  { x: 21, y: 8, w: 3, h: 1 },
  { x: 3, y: 3, w: 3, h: 1 }, // finance desk
  { x: 32, y: 3, w: 4, h: 1 }, // PM's desk
  { x: 2, y: 17, w: 1, h: 6 }, // records cabinets
  { x: 9, y: 17, w: 1, h: 6 },
  { x: 24, y: 19, w: 3, h: 2 }, // central hall table
]

function fill(grid: number[][], r: Rect, v: number) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = v
}

export function buildGrid(): number[][] {
  const grid = Array.from({ length: MAP_ROWS }, () => Array<number>(MAP_COLS).fill(1))
  ROOMS.forEach((r) => fill(grid, r.rect, 0))
  PASSAGES.forEach((p) => fill(grid, p, 0))
  FURNITURE.forEach((f) => fill(grid, f, 2))
  return grid
}

export const GRID = buildGrid()

const tileCenter = (tx: number, ty: number): Vec2 => ({
  x: tx * TILE_SIZE + TILE_SIZE / 2,
  y: ty * TILE_SIZE + TILE_SIZE / 2,
})

export interface TaskStationDef {
  stationId: string
  type: TaskType
  label: string
  roomId: RoomId
  position: Vec2
}

/** Task stations (Game Design §5A). Three mini-game types for the MVP. */
export const TASK_STATIONS: TaskStationDef[] = [
  { stationId: 'fin-budget', type: 'APPROVE_BILL', label: 'Approve the Budget', roomId: 'FINANCE_MINISTRY', position: tileCenter(4, 4) },
  { stationId: 'fin-ledger', type: 'FILE_SORT', label: 'Verify Allocations', roomId: 'FINANCE_MINISTRY', position: tileCenter(8, 7) },
  { stationId: 'pm-bill', type: 'APPROVE_BILL', label: 'Pass the Bill', roomId: 'PM_OFFICE', position: tileCenter(33, 4) },
  { stationId: 'pm-docs', type: 'FILE_SORT', label: 'Approve Government Documents', roomId: 'PM_OFFICE', position: tileCenter(36, 7) },
  { stationId: 'rec-files', type: 'FILE_SORT', label: 'Organize Files', roomId: 'RECORDS_ROOM', position: tileCenter(5, 18) },
  { stationId: 'rec-verify', type: 'FILE_SORT', label: 'Verify Records', roomId: 'RECORDS_ROOM', position: tileCenter(7, 22) },
  { stationId: 'ch-power', type: 'RESTORE_POWER', label: 'Restore Power', roomId: 'CENTRAL_HALL', position: tileCenter(16, 17) },
  { stationId: 'ch-comms', type: 'RESTORE_POWER', label: 'Repair Communications', roomId: 'CENTRAL_HALL', position: tileCenter(36, 22) },
  { stationId: 'ls-register', type: 'APPROVE_BILL', label: 'Sign the Register', roomId: 'LOK_SABHA', position: tileCenter(24, 10) },
]

/** Deep State sabotage point and the emergency meeting bell. */
export const POWER_PANEL: Vec2 = tileCenter(15, 22)
export const EMERGENCY_BUTTON: Vec2 = tileCenter(20, 4)

/** Spawn around the Lok Sabha after role reveal and after every meeting. */
export const SPAWN_POINTS: Vec2[] = [
  tileCenter(17, 3), tileCenter(18, 3), tileCenter(21, 3), tileCenter(22, 3), tileCenter(17, 7),
  tileCenter(18, 7), tileCenter(21, 7), tileCenter(22, 7), tileCenter(17, 10), tileCenter(22, 10),
]

export function isSolidTile(tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return true
  return GRID[ty][tx] !== 0
}

/** Axis-aligned check of a player's square hitbox against the tile grid. */
export function isWalkable(pos: Vec2, radius = 10): boolean {
  const corners = [
    [pos.x - radius, pos.y - radius],
    [pos.x + radius, pos.y - radius],
    [pos.x - radius, pos.y + radius],
    [pos.x + radius, pos.y + radius],
  ]
  return corners.every(([x, y]) => !isSolidTile(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)))
}

export function roomAt(pos: Vec2): RoomId | null {
  const tx = Math.floor(pos.x / TILE_SIZE)
  const ty = Math.floor(pos.y / TILE_SIZE)
  const room = ROOMS.find((r) => tx >= r.rect.x && tx < r.rect.x + r.rect.w && ty >= r.rect.y && ty < r.rect.y + r.rect.h)
  return room?.id ?? null
}
