/**
 * Static Parliament tileset drawn in code (Visual Pack area snapshots):
 * Lok Sabha green carpet + benches + Speaker's chair, PM Office parquet + desk,
 * Finance Ministry tiles, Records Room cabinets, Central Hall marble, red-carpet corridor.
 */
import { EMERGENCY_BUTTON, GRID, MAP_HEIGHT, MAP_WIDTH, POWER_PANEL, ROOMS, TILE_SIZE, type RoomId, type Vec2 } from '@netagiri/shared'

const T = TILE_SIZE

const FLOOR: Record<RoomId | 'CORRIDOR', [string, string]> = {
  LOK_SABHA: ['#3f6b4a', '#386142'],
  PM_OFFICE: ['#7a5236', '#6b4a3a'],
  FINANCE_MINISTRY: ['#b9a77f', '#a8976f'],
  RECORDS_ROOM: ['#6a5940', '#5f4f38'],
  CENTRAL_HALL: ['#d8c8a4', '#c9b893'],
  CORRIDOR: ['#8c7a5a', '#82704f'],
}

const roomAtTile = (x: number, y: number) =>
  ROOMS.find((r) => x >= r.rect.x && x < r.rect.x + r.rect.w && y >= r.rect.y && y < r.rect.y + r.rect.h)?.id

function floorTile(g: CanvasRenderingContext2D, x: number, y: number, room: RoomId | undefined) {
  const [a, b] = FLOOR[room ?? 'CORRIDOR']
  const px = x * T
  const py = y * T
  g.fillStyle = (x + y) % 2 ? a : b
  g.fillRect(px, py, T, T)
  if (room === 'PM_OFFICE' || room === 'RECORDS_ROOM') {
    g.fillStyle = 'rgba(0,0,0,0.15)'
    for (let i = 0; i < 4; i++) g.fillRect(px, py + i * 8 + (x % 2) * 4, T, 1) // planks
  } else if (room === 'CENTRAL_HALL') {
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.fillRect(px + 4, py + 4, 6, 1) // marble veins
    g.fillRect(px + 18, py + 20, 8, 1)
  } else if (room === 'FINANCE_MINISTRY') {
    g.strokeStyle = 'rgba(0,0,0,0.18)'
    g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1)
  } else if (!room) {
    // red carpet runner along corridors
    g.fillStyle = '#8f2f27'
    g.fillRect(px, py + 6, T, T - 12)
    g.fillStyle = '#f2c14e'
    g.fillRect(px, py + 6, T, 2)
    g.fillRect(px, py + T - 8, T, 2)
  }
}

function wallTile(g: CanvasRenderingContext2D, x: number, y: number) {
  const px = x * T
  const py = y * T
  g.fillStyle = '#2b1d14'
  g.fillRect(px, py, T, T)
  g.fillStyle = '#3a281b'
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 8 : 0
    for (let col = -1; col < 2; col++) g.fillRect(px + col * 16 + off + 1, py + row * 8 + 1, 14, 6)
  }
  if (GRID[y + 1]?.[x] === 0 || GRID[y + 1]?.[x] === 2) {
    g.fillStyle = '#d8c8a4'
    g.fillRect(px, py + T - 6, T, 3) // sandstone trim facing the room
  }
}

function furnitureTile(g: CanvasRenderingContext2D, x: number, y: number, room: RoomId | undefined) {
  const px = x * T
  const py = y * T
  floorTile(g, x, y, room)
  if (room === 'LOK_SABHA' && y === 2) {
    // Speaker's chair
    g.fillStyle = '#5a2e1a'
    g.fillRect(px + 2, py - 10, T - 4, T + 8)
    g.fillStyle = '#7a4b2a'
    g.fillRect(px + 5, py + 4, T - 10, T - 8)
    g.fillStyle = '#f2c14e'
    g.fillRect(px + 2, py - 10, T - 4, 3)
  } else if (room === 'LOK_SABHA') {
    // green leather benches
    g.fillStyle = '#2f5a3a'
    g.fillRect(px, py + 2, T, T - 6)
    g.fillStyle = '#4f8a5a'
    g.fillRect(px, py + 2, T, 8)
    g.fillStyle = '#1e3a26'
    g.fillRect(px, py + T - 6, T, 3)
  } else if (room === 'RECORDS_ROOM') {
    // steel cabinets with drawers
    g.fillStyle = '#6f7378'
    g.fillRect(px + 2, py, T - 4, T)
    g.fillStyle = '#4a4e53'
    for (let i = 0; i < 3; i++) g.fillRect(px + 4, py + 3 + i * 10, T - 8, 7)
    g.fillStyle = '#d8c8a4'
    for (let i = 0; i < 3; i++) g.fillRect(px + 13, py + 5 + i * 10, 6, 2)
  } else {
    // wooden desks / tables with papers
    g.fillStyle = '#5a3520'
    g.fillRect(px, py + 2, T, T - 4)
    g.fillStyle = '#7a4b2a'
    g.fillRect(px, py + 2, T, 6)
    g.fillStyle = '#f5e6c8'
    if ((x + y) % 2) g.fillRect(px + 8, py + 12, 12, 9)
  }
}

function prop(g: CanvasRenderingContext2D, kind: 'plant' | 'flag' | 'emblem' | 'bust' | 'shelf', tx: number, ty: number) {
  const px = tx * T
  const py = ty * T
  if (kind === 'plant') {
    g.fillStyle = '#7a4b2a'
    g.fillRect(px + 10, py + 20, 12, 10)
    g.fillStyle = '#3f9d4e'
    g.fillRect(px + 6, py + 6, 20, 14)
    g.fillStyle = '#2f7a3c'
    g.fillRect(px + 10, py + 2, 12, 8)
  } else if (kind === 'flag') {
    g.fillStyle = '#ccc'
    g.fillRect(px + 6, py + 2, 2, 28)
    const band = ['#e8873a', '#f4f1ea', '#3f9d4e']
    band.forEach((c, i) => {
      g.fillStyle = c
      g.fillRect(px + 8, py + 3 + i * 5, 18, 5)
    })
    g.fillStyle = '#2b3f73'
    g.fillRect(px + 16, py + 9, 2, 2)
  } else if (kind === 'emblem') {
    g.fillStyle = '#f2c14e'
    g.fillRect(px + 8, py + 4, 16, 22)
    g.fillStyle = '#b08a2e'
    g.fillRect(px + 12, py + 8, 8, 10)
    g.fillRect(px + 6, py + 24, 20, 4)
  } else if (kind === 'bust') {
    g.fillStyle = '#9a958b'
    g.fillRect(px + 10, py + 18, 12, 12)
    g.fillStyle = '#bdb8ad'
    g.fillRect(px + 11, py + 4, 10, 12)
  } else {
    g.fillStyle = '#5a3520'
    g.fillRect(px + 2, py + 2, T - 4, T - 4)
    const books = ['#a8463d', '#2b3f73', '#607b57', '#f2c14e']
    for (let i = 0; i < 6; i++) {
      g.fillStyle = books[i % 4]
      g.fillRect(px + 4 + i * 4, py + 5, 3, 10)
      g.fillRect(px + 4 + i * 4, py + 18, 3, 10)
    }
  }
}

function marker(g: CanvasRenderingContext2D, p: Vec2, kind: 'bell' | 'power') {
  if (kind === 'bell') {
    g.fillStyle = '#5a3520'
    g.fillRect(p.x - 12, p.y - 4, 24, 14)
    g.fillStyle = '#a8463d'
    g.fillRect(p.x - 8, p.y - 14, 16, 10)
    g.fillStyle = '#ff8f84'
    g.fillRect(p.x - 5, p.y - 12, 6, 3)
  } else {
    g.fillStyle = '#4a4e53'
    g.fillRect(p.x - 12, p.y - 14, 24, 26)
    g.fillStyle = '#f2c14e'
    g.beginPath()
    g.moveTo(p.x + 2, p.y - 10)
    g.lineTo(p.x - 6, p.y + 1)
    g.lineTo(p.x, p.y + 1)
    g.lineTo(p.x - 3, p.y + 9)
    g.lineTo(p.x + 6, p.y - 3)
    g.lineTo(p.x, p.y - 3)
    g.closePath()
    g.fill()
  }
  g.strokeStyle = '#000'
  g.lineWidth = 2
  g.strokeRect(p.x - 12, p.y - 14, 24, 26)
  g.font = '8px "Press Start 2P", monospace'
  g.textAlign = 'center'
  g.fillStyle = '#000'
  g.fillText(kind === 'bell' ? 'MEETING' : 'POWER', p.x + 1, p.y + 25)
  g.fillStyle = '#f5e6c8'
  g.fillText(kind === 'bell' ? 'MEETING' : 'POWER', p.x, p.y + 24)
}

export function drawParliament(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = MAP_WIDTH
  c.height = MAP_HEIGHT
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  for (let y = 0; y < GRID.length; y++) {
    for (let x = 0; x < GRID[y].length; x++) {
      const t = GRID[y][x]
      if (t === 1) wallTile(g, x, y)
      else if (t === 0) floorTile(g, x, y, roomAtTile(x, y))
    }
  }
  // furniture after floor so tall pieces can overlap the row above
  for (let y = 0; y < GRID.length; y++) for (let x = 0; x < GRID[y].length; x++) if (GRID[y][x] === 2) furnitureTile(g, x, y, roomAtTile(x, y))

  // decorative props sit on wall tiles so they never block movement
  prop(g, 'emblem', 19, 0)
  prop(g, 'emblem', 20, 0)
  prop(g, 'flag', 14, 0)
  prop(g, 'flag', 25, 0)
  prop(g, 'plant', 1, 0)
  prop(g, 'plant', 38, 0)
  prop(g, 'shelf', 4, 14)
  prop(g, 'shelf', 7, 14)
  prop(g, 'bust', 26, 14)
  prop(g, 'bust', 13, 14)
  prop(g, 'plant', 31, 14)
  prop(g, 'flag', 32, 0)

  marker(g, EMERGENCY_BUTTON, 'bell')
  marker(g, POWER_PANEL, 'power')

  g.font = '11px "Press Start 2P", monospace'
  g.textAlign = 'center'
  for (const r of ROOMS) {
    const cx = (r.rect.x + r.rect.w / 2) * T
    const cy = (r.rect.y + r.rect.h) * T - 8
    const w = g.measureText(r.label).width + 14
    g.fillStyle = 'rgba(17,28,40,0.8)'
    g.fillRect(cx - w / 2, cy - 15, w, 21)
    g.strokeStyle = '#8a6b3b'
    g.strokeRect(cx - w / 2 + 0.5, cy - 14.5, w - 1, 20)
    g.fillStyle = '#f2c14e'
    g.fillText(r.label.toUpperCase(), cx, cy)
  }
  return c
}
