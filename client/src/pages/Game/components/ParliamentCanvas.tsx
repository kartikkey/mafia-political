/**
 * Renders the shared Parliament map (Game Design §4): code-drawn tileset,
 * task stations, bodies and animated A1–A8 sprites. The camera follows the
 * local player at the chosen zoom (zoom 1 = whole map).
 */
import { useEffect, useRef, type MutableRefObject } from 'react'
import { MAP_HEIGHT, MAP_WIDTH, type Body, type PublicPlayer, type TaskInstance, type Vec2 } from '@netagiri/shared'
import { AVATARS } from 'helpers/avatars'
import { drawBody, drawSprite, SPRITE_H, SPRITE_W } from 'helpers/sprites'
import { drawParliament } from 'helpers/tiles'
import { ANIM_FRAME_MS, CAMERA_LERP } from 'config/constants'

interface Props {
  players: PublicPlayer[]
  tasks: TaskInstance[]
  bodies: Body[]
  meId: string | null
  localPos: MutableRefObject<Vec2 | null>
  highlightTaskIds: string[]
  highlightBodyId: string | null
  teammateIds: string[]
  /** playerId → taskId, everyone (incl. Deep State faking) currently at a station. */
  interactingIds: string[]
  disabledTaskIds: string[]
  powerOut: boolean
  zoom: number
}

const PX = 2 // world pixels per sprite pixel

function drawStation(g: CanvasRenderingContext2D, task: TaskInstance, highlight: boolean, leaked: boolean, t: number) {
  const { x, y } = task.position
  const done = task.status === 'COMPLETE'
  const pulse = highlight && !done ? 2 + Math.sin(t / 180) * 2 : 0
  g.fillStyle = 'rgba(0,0,0,0.35)'
  g.fillRect(x - 11, y + 8, 22, 4)
  g.fillStyle = done ? '#607b57' : leaked ? '#5a1e18' : '#1b2b3d'
  g.fillRect(x - 10 - pulse, y - 10 - pulse, 20 + pulse * 2, 20 + pulse * 2)
  g.strokeStyle = leaked ? '#ff8f84' : highlight ? '#f2c14e' : '#000'
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
  if (leaked) {
    // scattered papers + flashing tag
    g.fillStyle = '#f5e6c8'
    for (let i = 0; i < 4; i++) g.fillRect(x - 16 + ((i * 11 + Math.floor(t / 300)) % 32), y + 10 + (i % 2) * 5, 6, 4)
    if (Math.floor(t / 400) % 2) {
      g.font = '8px "Press Start 2P", monospace'
      g.textAlign = 'center'
      g.fillStyle = '#ff8f84'
      g.fillText('LEAK', x, y + 30)
    }
  }
  if (done) {
    g.fillStyle = '#f5e6c8'
    g.font = '10px "Press Start 2P", monospace'
    g.textAlign = 'center'
    g.fillText('OK', x, y + 22)
  }
}

/** "Working…" bubble — shown identically for real and fake tasks. */
function drawWorkBubble(g: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  g.fillStyle = '#f5e6c8'
  g.fillRect(x - 13, y - 9, 26, 12)
  g.fillRect(x - 3, y + 3, 4, 3)
  g.strokeStyle = '#000'
  g.lineWidth = 2
  g.strokeRect(x - 13, y - 9, 26, 12)
  g.fillStyle = '#111c28'
  for (let i = 0; i <= frame % 3; i++) g.fillRect(x - 8 + i * 7, y - 4, 3, 3)
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
    const cam = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, scale: 0 }
    let raf = 0

    const fitCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const r = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.round(r.width * dpr))
      const h = Math.max(1, Math.round(r.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }
    const ro = new ResizeObserver(fitCanvas)
    ro.observe(canvas)
    fitCanvas()

    const render = (t: number) => {
      const p = latest.current
      const frame = Math.floor(t / ANIM_FRAME_MS)
      const me = p.players.find((x) => x.id === p.meId)
      const focus = (me && p.localPos.current) || me?.position || { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }

      // Camera: scale fits the whole map at zoom 1; follow + clamp to map edges.
      const fit = Math.min(canvas.width / MAP_WIDTH, canvas.height / MAP_HEIGHT)
      const scale = fit * p.zoom
      const viewW = canvas.width / scale
      const viewH = canvas.height / scale
      const clamp = (v: number, view: number, size: number) => (view >= size ? size / 2 : Math.min(size - view / 2, Math.max(view / 2, v)))
      const tx = clamp(focus.x, viewW, MAP_WIDTH)
      const ty = clamp(focus.y, viewH, MAP_HEIGHT)
      const snap = cam.scale !== scale
      cam.x = snap ? tx : cam.x + (tx - cam.x) * CAMERA_LERP
      cam.y = snap ? ty : cam.y + (ty - cam.y) * CAMERA_LERP
      cam.scale = scale

      g.setTransform(1, 0, 0, 1, 0, 0)
      g.fillStyle = '#0b1219'
      g.fillRect(0, 0, canvas.width, canvas.height)
      g.setTransform(scale, 0, 0, scale, Math.round(canvas.width / 2 - cam.x * scale), Math.round(canvas.height / 2 - cam.y * scale))
      g.imageSmoothingEnabled = false
      g.drawImage(bg, 0, 0)

      for (const task of p.tasks) drawStation(g, task, p.highlightTaskIds.includes(task.taskId), p.disabledTaskIds.includes(task.taskId), t)

      for (const b of p.bodies) {
        if (b.reported) continue
        const owner = p.players.find((x) => x.id === b.playerId)
        drawBody(g, AVATARS[(owner?.avatar ?? 0) % AVATARS.length], b.position.x, b.position.y, PX, frame)
        if (b.bodyId === p.highlightBodyId) {
          const r = 20 + Math.sin(t / 150) * 4
          g.strokeStyle = '#ff8f84'
          g.lineWidth = 3
          g.strokeRect(b.position.x - r, b.position.y - r, r * 2, r * 2)
        }
      }

      const sorted = [...p.players].sort((a, b) => a.position.y - b.position.y)
      for (const pl of sorted) {
        if (!pl.alive || !pl.connected) continue
        const pos = pl.id === p.meId && p.localPos.current ? p.localPos.current : pl.position
        const prev = lastPos.get(pl.id)
        if (!prev || prev.x !== pos.x || prev.y !== pos.y) lastPos.set(pl.id, { x: pos.x, y: pos.y, movedAt: t })
        const walking = t - (lastPos.get(pl.id)?.movedAt ?? 0) < 120
        const working = p.interactingIds.includes(pl.id)
        const mode = working ? 'interact' : walking ? 'walk' : 'idle'
        const a = AVATARS[pl.avatar % AVATARS.length]
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(pos.x - 9, pos.y + 9, 18, 4)
        drawSprite(g, a, pos.x - (SPRITE_W * PX) / 2, pos.y + 12 - SPRITE_H * PX, PX, pl.facing, mode, Math.floor(t / 250))
        if (working) drawWorkBubble(g, pos.x + 16, pos.y - 30, Math.floor(t / 300))
        g.font = '16px VT323, monospace'
        g.textAlign = 'center'
        const mate = p.teammateIds.includes(pl.id)
        const label = mate ? `${pl.name} [AGENT]` : pl.name
        g.fillStyle = '#000'
        g.fillText(label, pos.x + 1, pos.y - 26)
        g.fillStyle = pl.id === p.meId ? '#f2c14e' : mate ? '#ff8f84' : '#f5e6c8'
        g.fillText(label, pos.x, pos.y - 27)
      }

      if (p.powerOut) {
        g.fillStyle = 'rgba(8,10,30,0.35)'
        g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="parliament-canvas" aria-label="Parliament map" data-testid="parliament-canvas" data-zoom={props.zoom} />
}
