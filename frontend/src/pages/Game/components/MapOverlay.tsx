import { useEffect, useRef } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { MAP_HEIGHT, MAP_WIDTH, type TaskInstance, type Vec2 } from '@netagiri/shared'
import { drawParliament } from 'helpers/tiles'

interface Props {
  tasks: TaskInstance[]
  disabledTaskIds: string[]
  me: Vec2 | null
  onClose: () => void
}

type StationState = 'open' | 'done' | 'offline'
const STYLE: Record<StationState, { fill: string; mark: string }> = {
  open: { fill: '#3f9d4e', mark: '!' },
  done: { fill: '#6b6f78', mark: '✓' },
  offline: { fill: '#c0392b', mark: 'X' },
}

/** M: full Parliament map with room names + station status (open / done / offline). No other players shown. */
export default function MapOverlay({ tasks, disabledTaskIds, me, onClose }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const g = ref.current!.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(drawParliament(), 0, 0)
    g.fillStyle = 'rgba(8,12,20,0.35)'
    g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
    g.textAlign = 'center'
    for (const t of tasks) {
      const state: StationState = disabledTaskIds.includes(t.taskId) ? 'offline' : t.status === 'COMPLETE' ? 'done' : 'open'
      const { x, y } = t.position
      g.fillStyle = STYLE[state].fill
      g.fillRect(x - 13, y - 13, 26, 26)
      g.strokeStyle = '#000'
      g.lineWidth = 3
      g.strokeRect(x - 13, y - 13, 26, 26)
      g.fillStyle = '#fff'
      g.font = '14px "Press Start 2P", monospace'
      g.fillText(STYLE[state].mark, x + 1, y + 7)
      g.font = '18px VT323, monospace'
      g.fillStyle = '#000'
      g.fillText(t.label, x + 1, y + 31)
      g.fillStyle = state === 'offline' ? '#ff8f84' : '#f5e6c8'
      g.fillText(state === 'offline' ? `${t.label} (OFFLINE)` : t.label, x, y + 30)
    }
    if (me) {
      g.fillStyle = '#f2c14e'
      g.beginPath()
      g.arc(me.x, me.y, 12, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#000'
      g.stroke()
      g.font = '10px "Press Start 2P", monospace'
      g.fillStyle = '#f2c14e'
      g.fillText('YOU', me.x, me.y - 18)
    }
  }, [tasks, disabledTaskIds, me?.x, me?.y])

  return (
    <div className="map-overlay" role="dialog" aria-label="Parliament map" data-testid="map-overlay" onClick={onClose}>
      <div className="map-overlay__panel" onClick={(e) => e.stopPropagation()}>
        <header className="map-overlay__head">
          <h2><MapIcon size={16} aria-hidden /> Parliament Map</h2>
          <ul className="map-overlay__legend">
            <li><span style={{ background: STYLE.open.fill }}>!</span> Open</li>
            <li><span style={{ background: STYLE.done.fill }}>✓</span> Done</li>
            <li><span style={{ background: STYLE.offline.fill }}>X</span> Offline (leak)</li>
          </ul>
          <button className="map-overlay__close" onClick={onClose} data-testid="map-overlay-close">M / ESC — close</button>
        </header>
        <canvas ref={ref} width={MAP_WIDTH} height={MAP_HEIGHT} className="map-overlay__canvas" />
      </div>
    </div>
  )
}
