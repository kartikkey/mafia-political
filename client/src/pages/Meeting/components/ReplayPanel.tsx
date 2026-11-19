import { useEffect, useRef, useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import type { MeetingReplay, PublicPlayer } from '@netagiri/shared'
import { AVATARS } from 'helpers/avatars'
import { drawSprite, SPRITE_H, SPRITE_W } from 'helpers/sprites'
import { drawParliament } from 'helpers/tiles'
import { REPLAY_SPEED } from 'config/constants'

const SIZE = 300
let bgCache: HTMLCanvasElement | null = null

/** Body-report replay: the last ~10s of who moved near the body, cropped mini-map, 2× speed. */
export default function ReplayPanel({ replay, players }: { replay: MeetingReplay; players: PublicPlayer[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [run, setRun] = useState(0)
  const [frame, setFrame] = useState(0)
  const total = replay.frames.length

  useEffect(() => {
    if (!total) return
    setFrame(0)
    let i = 0
    const id = setInterval(() => {
      i = Math.min(total - 1, i + 1)
      setFrame(i)
      if (i === total - 1) clearInterval(id)
    }, replay.frameMs / REPLAY_SPEED)
    return () => clearInterval(id)
  }, [replay, run])

  useEffect(() => {
    const g = ref.current?.getContext('2d')
    if (!g || !total) return
    bgCache ??= drawParliament()
    const span = replay.radius * 2
    const scale = SIZE / span
    const ox = replay.center.x - replay.radius
    const oy = replay.center.y - replay.radius
    g.imageSmoothingEnabled = false
    g.fillStyle = '#0b1219'
    g.fillRect(0, 0, SIZE, SIZE)
    g.drawImage(bgCache, ox, oy, span, span, 0, 0, SIZE, SIZE)
    const last = frame === total - 1
    if (last) {
      const cx = replay.radius * scale
      g.strokeStyle = '#ff8f84'
      g.lineWidth = 3
      g.strokeRect(cx - 14, cx - 14, 28, 28)
    }
    g.font = '14px VT323, monospace'
    g.textAlign = 'center'
    for (const p of replay.frames[frame].players) {
      const who = players.find((x) => x.id === p.id)
      if (!who) continue
      const x = (p.x - ox) * scale
      const y = (p.y - oy) * scale
      drawSprite(g, AVATARS[who.avatar % AVATARS.length], x - SPRITE_W, y + 8 - SPRITE_H * 2 + 6, 2, 'down', 'idle', 0)
      g.fillStyle = '#000'
      g.fillText(who.name, x + 1, y - 22)
      g.fillStyle = p.id === replay.bodyPlayerId ? '#ff8f84' : '#f5e6c8'
      g.fillText(who.name, x, y - 23)
    }
  }, [frame, replay, players])

  const secsAgo = Math.round(((total - 1 - frame) * replay.frameMs) / 1000)
  return (
    <div className="replay" data-testid="meeting-replay">
      <h2 className="replay__title"><History size={14} aria-hidden /> Last {Math.round((total * replay.frameMs) / 1000)}s near the body</h2>
      {total ? (
        <canvas ref={ref} width={SIZE} height={SIZE} className="replay__canvas" aria-label="Replay of movement near the body" />
      ) : (
        <p className="muted">No footage — the cameras caught nothing.</p>
      )}
      <div className="replay__bar">
        <span data-testid="meeting-replay-time">{frame === total - 1 ? 'Body found here' : `−${secsAgo}s`}</span>
        <button className="replay__again" onClick={() => setRun((r) => r + 1)} data-testid="meeting-replay-again">
          <RotateCcw size={14} aria-hidden /> Replay
        </button>
      </div>
    </div>
  )
}
