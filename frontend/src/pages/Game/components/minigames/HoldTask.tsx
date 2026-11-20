import { useEffect, useState } from 'react'
import type { HoldPuzzle } from '@netagiri/shared'

interface Props {
  puzzle: HoldPuzzle
  error: string | null
  busy: boolean
  onSubmit: (payload: unknown) => void
}

/** Spec §6.4 fallback: progress fills while the modal stays open, then the server checks the elapsed time. */
export default function HoldTask({ puzzle, error, busy, onSubmit }: Props) {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let sent = false
    const id = setInterval(() => {
      const p = Math.min(100, ((performance.now() - start) / puzzle.ms) * 100)
      setPct(p)
      if (p >= 100 && !sent) {
        sent = true
        onSubmit({ held: true })
      }
    }, 50)
    return () => clearInterval(id)
  }, [puzzle, error])

  return (
    <div className="hold-task">
      <div className="hud__bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="hud__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p>{busy ? 'Submitting…' : `${Math.round(pct)}%`}</p>
    </div>
  )
}
