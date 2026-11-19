/**
 * Renders the shared Parliament map (Game Design §4): code-drawn tileset,
 * task stations, bodies and animated A1–A8 sprites.
 */
import { useEffect, useRef, type MutableRefObject } from 'react'
import { MAP_HEIGHT, MAP_WIDTH, type Body, type PublicPlayer, type TaskInstance, type Vec2 } from '@netagiri/shared'
import { AVATARS } from 'helpers/avatars'
import { drawBody, drawSprite, SPRITE_H, SPRITE_W } from 'helpers/sprites'
import { drawParliament } from 'helpers/tiles'
import { ANIM_FRAME_MS } from 'config/constants'

interface Props {
  players: PublicPlayer[]
  tasks: TaskInstance[]
  bodies: Body[]
  meId: string | null
  localPos: MutableRefObject<Vec2 | null>
  highlightTaskIds: string[]
  highlightBodyId: string | null
  teammateIds: string[]
  interacting: boolean
  powerOut: boolean
}

const PX = 2 // world pixels per sprite pixel

function drawStation(g: CanvasRenderingContext2D, task: TaskInstance, highlight: boolean, t: number) {
  const { x, y } = task.position
  const done = task.status === 'COMPLETE'
  const pulse = highlight && !done ? 2 + Math.sin(t / 180) * 2 : 0
  g.fillStyle = 'rgba(0,0,0,0.35)'
  g.fillRect(x - 11, y + 8, 22, 4)
  g.fillStyle = done ? '#607b57' : '#1b2b3d'
  g.fillRect(x - 10 - pulse, y - 10 - pulse, 20 + pulse * 2, 20 + pulse * 2)
  g.strokeStyle = highlight ? '#f2c14e' : '#000'
  g.lineWidth = 2
  g.strokeRect(x - 10 - pulse, y - 10 - pulse, 20 + pulse * 2, 20 + pulse * 2)
  g.fillStyle = '#d8c8a4'
  if (task.type === 'FILE_SORT') {
    g.fillRect(x - 6, y - 5, 12, 9)
    g.fillRect(x - 6, y - 7, 5, 2)
  } else if (task.type === 'RESTORE_POWER') {
    g.fillStyle = '#f2c14e'
    g.fillRect(x - 1, y - 7, 3, 7)
    g.fillRect(x - 3, y, 3, 6)
  } else {
    g.fillRect(x - 5, y - 7, 10, 13)
    g.fillStyle = '#a8463d'
    g.fillRect(x - 2, y + 1, 4, 4)
  }
  if (done) {
    g.fillStyle = '#f5e6c8'
    g.font = '10px "Press Start 2P", monospace'
    g.textAlign = 'center'
    g.fillText('OK', x, y + 22)
  }
}

export default function ParliamentCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    const canvas = canvasRef.current!
    const g = canvas.getContext('2d')!
    let bg = drawParliament()
    document.fonts?.ready.then(() => (bg = drawParliament()))
    const lastPos = new Map<string, { x: number; y: number; movedAt: number }>()
    let raf = 0

    const render = (t: number) => {
      const { players, tasks, bodies, meId, localPos, highlightTaskIds, highlightBodyId, teammateIds, interacting, powerOut } = latest.current
      const frame = Math.floor(t / ANIM_FRAME_MS)
      g.imageSmoothingEnabled = false
      g.drawImage(bg, 0, 0)

      for (const task of tasks) drawStation(g, task, highlightTaskIds.includes(task.taskId), t)

      for (const b of bodies) {
        if (b.reported) continue
        const p = players.find((x) => x.id === b.playerId)
        drawBody(g, AVATARS[(p?.avatar ?? 0) % AVATARS.length], b.position.x, b.position.y, PX, frame)
        if (b.bodyId === highlightBodyId) {
          const r = 20 + Math.sin(t / 150) * 4
          g.strokeStyle = '#ff8f84'
          g.lineWidth = 3
          g.strokeRect(b.position.x - r, b.position.y - r, r * 2, r * 2)
        }
      }

      const sorted = [...players].sort((a, b) => a.position.y - b.position.y)
      for (const p of sorted) {
        if (!p.alive || !p.connected) continue
        const pos = p.id === meId && localPos.current ? localPos.current : p.position
        const prev = lastPos.get(p.id)
        const moved = !prev || prev.x !== pos.x || prev.y !== pos.y
        if (moved) lastPos.set(p.id, { x: pos.x, y: pos.y, movedAt: t })
        const walking = t - (lastPos.get(p.id)?.movedAt ?? 0) < 120
        const mode = p.id === meId && interacting ? 'interact' : walking ? 'walk' : 'idle'
        const a = AVATARS[p.avatar % AVATARS.length]
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(pos.x - 9, pos.y + 9, 18, 4)
        drawSprite(g, a, pos.x - (SPRITE_W * PX) / 2, pos.y + 12 - SPRITE_H * PX, PX, p.facing, mode, frame)
        g.font = '16px VT323, monospace'
        g.textAlign = 'center'
        const label = teammateIds.includes(p.id) ? `${p.name} [AGENT]` : p.name
        g.fillStyle = '#000'
        g.fillText(label, pos.x + 1, pos.y - 26)
        g.fillStyle = p.id === meId ? '#f2c14e' : teammateIds.includes(p.id) ? '#ff8f84' : '#f5e6c8'
        g.fillText(label, pos.x, pos.y - 27)
      }

      if (powerOut) {
        g.fillStyle = 'rgba(8,10,30,0.35)'
        g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} width={MAP_WIDTH} height={MAP_HEIGHT} className="parliament-canvas" aria-label="Parliament map" data-testid="parliament-canvas" />
}
