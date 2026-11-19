/**
 * Renders the shared Parliament map (Game Design §4) and players.
 * Placeholder flat-colour tiles — swap for 16-bit tilesets from
 * assets/images once drawn (Visual Reference Pack, Boards 1–3).
 */
import { useEffect, useRef, type MutableRefObject } from 'react'
import {
  EMERGENCY_BUTTON,
  GRID,
  MAP_HEIGHT,
  MAP_WIDTH,
  POWER_PANEL,
  ROOMS,
  TILE_SIZE,
  type PublicPlayer,
  type TaskInstance,
  type Vec2,
} from '@netagiri/shared'
import { AVATARS } from 'helpers/avatars'

interface Props {
  players: PublicPlayer[]
  tasks: TaskInstance[]
  meId: string | null
  localPos: MutableRefObject<Vec2 | null>
  highlightTaskIds: string[]
}

const ROOM_FLOOR: Record<string, string> = {
  LOK_SABHA: '#3f6b4a',
  PM_OFFICE: '#6b4a3a',
  FINANCE_MINISTRY: '#4e5a3a',
  RECORDS_ROOM: '#5a4a35',
  CENTRAL_HALL: '#7a6648',
}

function drawStatic(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = MAP_WIDTH
  c.height = MAP_HEIGHT
  const g = c.getContext('2d')!
  for (let y = 0; y < GRID.length; y++) {
    for (let x = 0; x < GRID[y].length; x++) {
      const t = GRID[y][x]
      const room = ROOMS.find((r) => x >= r.rect.x && x < r.rect.x + r.rect.w && y >= r.rect.y && y < r.rect.y + r.rect.h)
      g.fillStyle = t === 1 ? '#2b1d14' : t === 2 ? '#7a4b2a' : room ? ROOM_FLOOR[room.id] : '#8c7a5a'
      g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      if (t === 0) {
        g.strokeStyle = 'rgba(0,0,0,0.12)'
        g.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
      }
    }
  }
  g.font = '12px "Press Start 2P", monospace'
  g.textAlign = 'center'
  for (const r of ROOMS) {
    const cx = (r.rect.x + r.rect.w / 2) * TILE_SIZE
    const cy = (r.rect.y + r.rect.h) * TILE_SIZE - 10
    g.fillStyle = 'rgba(0,0,0,0.55)'
    const w = g.measureText(r.label).width + 12
    g.fillRect(cx - w / 2, cy - 14, w, 20)
    g.fillStyle = '#f2c14e'
    g.fillText(r.label, cx, cy)
  }
  // Emergency bell + power panel markers.
  const mark = (p: Vec2, color: string, label: string) => {
    g.fillStyle = color
    g.fillRect(p.x - 10, p.y - 10, 20, 20)
    g.strokeStyle = '#000'
    g.lineWidth = 3
    g.strokeRect(p.x - 10, p.y - 10, 20, 20)
    g.fillStyle = '#fff'
    g.font = '8px "Press Start 2P", monospace'
    g.fillText(label, p.x, p.y + 22)
  }
  mark(EMERGENCY_BUTTON, '#a8463d', 'MEETING')
  mark(POWER_PANEL, '#f2c14e', 'POWER')
  return c
}

export default function ParliamentCanvas({ players, tasks, meId, localPos, highlightTaskIds }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ players, tasks, highlightTaskIds })
  latest.current = { players, tasks, highlightTaskIds }

  useEffect(() => {
    const canvas = canvasRef.current!
    const g = canvas.getContext('2d')!
    let bg = drawStatic()
    document.fonts?.ready.then(() => (bg = drawStatic()))
    let raf = 0

    const render = (t: number) => {
      const { players, tasks, highlightTaskIds } = latest.current
      g.imageSmoothingEnabled = false
      g.drawImage(bg, 0, 0)

      for (const task of tasks) {
        const done = task.status === 'COMPLETE'
        const pulse = highlightTaskIds.includes(task.taskId) && !done ? 3 + Math.sin(t / 200) * 2 : 0
        g.fillStyle = done ? '#607b57' : '#d8c8a4'
        g.fillRect(task.position.x - 8 - pulse, task.position.y - 8 - pulse, 16 + pulse * 2, 16 + pulse * 2)
        g.strokeStyle = '#000'
        g.lineWidth = 2
        g.strokeRect(task.position.x - 8, task.position.y - 8, 16, 16)
      }

      for (const p of players) {
        const pos = p.id === meId && localPos.current ? localPos.current : p.position
        const a = AVATARS[p.avatar % AVATARS.length]
        if (!p.alive) continue // bodies are drawn from match.bodies (Prompt 5)
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(pos.x - 9, pos.y + 8, 18, 4)
        g.fillStyle = a.outfit
        g.fillRect(pos.x - 8, pos.y - 4, 16, 14)
        g.fillStyle = a.accent
        g.fillRect(pos.x - 8, pos.y + 2, 16, 2)
        g.fillStyle = '#c68b5e'
        g.fillRect(pos.x - 6, pos.y - 14, 12, 10)
        g.strokeStyle = '#000'
        g.lineWidth = 2
        g.strokeRect(pos.x - 8, pos.y - 14, 16, 24)
        g.font = '14px VT323, monospace'
        g.textAlign = 'center'
        g.fillStyle = p.id === meId ? '#f2c14e' : '#fff'
        g.fillText(p.name, pos.x, pos.y - 18)
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [meId])

  return <canvas ref={canvasRef} width={MAP_WIDTH} height={MAP_HEIGHT} className="parliament-canvas" aria-label="Parliament map" />
}
