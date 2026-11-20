import { useEffect, useState } from 'react'
import type { RestorePowerPuzzle } from '@netagiri/shared'
import { playSound } from 'helpers/sound'

interface Props {
  puzzle: RestorePowerPuzzle
  error: string | null
  busy: boolean
  onSubmit: (payload: unknown) => void
}

const ROW_H = 64

/** Spec §6.2: connect three coloured terminals (colour + text label). Server validates the pairs. */
export default function RestorePower({ puzzle, error, busy, onSubmit }: Props) {
  const [pairs, setPairs] = useState<Record<string, string>>({})
  const [source, setSource] = useState<string | null>(null)
  const [shake, setShake] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    if (error) setPairs({})
  }, [error])

  const pickTarget = (targetId: string) => {
    if (!source) return
    const s = puzzle.sources.find((x) => x.id === source)!
    const t = puzzle.targets.find((x) => x.id === targetId)!
    if (s.label !== t.label) {
      playSound('error')
      setShake(targetId)
      setHint(`Wrong terminal — ${s.label} goes to ${s.label}`)
      setTimeout(() => setShake(null), 300)
      return
    }
    const next = { ...Object.fromEntries(Object.entries(pairs).filter(([, v]) => v !== targetId)), [source]: targetId }
    setPairs(next)
    setSource(null)
    setHint(null)
    playSound('vote')
    if (Object.keys(next).length === puzzle.sources.length) onSubmit(next)
  }

  const yOf = (list: { id: string }[], id: string) => list.findIndex((x) => x.id === id) * ROW_H + ROW_H / 2

  return (
    <>
    <div className="wires">
      <div className="wires__col">
        {puzzle.sources.map((s) => (
          <button
            key={s.id}
            className={`terminal ${source === s.id ? 'is-selected' : ''} ${pairs[s.id] ? 'is-linked' : ''}`}
            style={{ borderColor: s.color }}
            onClick={() => setSource(s.id)}
            disabled={busy}
            data-testid={`wire-source-${s.label}`}
          >
            <span className="terminal__dot" style={{ background: s.color }} /> {s.label}
          </button>
        ))}
      </div>
      <svg className="wires__lines" width="120" height={ROW_H * puzzle.sources.length} aria-hidden>
        {Object.entries(pairs).map(([sid, tid]) => {
          const s = puzzle.sources.find((x) => x.id === sid)!
          return <line key={sid} x1="0" y1={yOf(puzzle.sources, sid)} x2="120" y2={yOf(puzzle.targets, tid)} stroke={s.color} strokeWidth="6" />
        })}
      </svg>
      <div className="wires__col">
        {puzzle.targets.map((t) => (
          <button
            key={t.id}
            className={`terminal ${shake === t.id ? 'is-shake' : ''}`}
            style={{ borderColor: t.color }}
            onClick={() => pickTarget(t.id)}
            disabled={busy || !source}
            data-testid={`wire-target-${t.label}`}
          >
            <span className="terminal__dot" style={{ background: t.color }} /> {t.label}
          </button>
        ))}
      </div>
    </div>
    {hint && <p className="task-modal__error" role="status" data-testid="wire-hint">{hint}</p>}
    </>
  )
}
