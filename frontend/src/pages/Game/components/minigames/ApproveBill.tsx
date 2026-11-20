import { useEffect, useState } from 'react'
import { BookOpen, Flag, IndianRupee, Landmark, type LucideIcon } from 'lucide-react'
import type { ApproveBillPuzzle, BillSymbol } from '@netagiri/shared'
import { playSound } from 'helpers/sound'

interface Props {
  puzzle: ApproveBillPuzzle
  error: string | null
  busy: boolean
  onSubmit: (payload: unknown) => void
}

const ICONS: Record<BillSymbol, { icon: LucideIcon; label: string }> = {
  BOOK: { icon: BookOpen, label: 'Book' },
  RUPEE: { icon: IndianRupee, label: 'Rupee' },
  BUILDING: { icon: Landmark, label: 'Parliament' },
  FLAG: { icon: Flag, label: 'Flag' },
}

/** Spec §6.3: flash a 3-symbol sequence, then the player repeats it. Wrong → "Try again". */
export default function ApproveBill({ puzzle, error, busy, onSubmit }: Props) {
  const [showing, setShowing] = useState(true)
  const [flash, setFlash] = useState(-1)
  const [input, setInput] = useState<BillSymbol[]>([])
  const [retry, setRetry] = useState(false)

  useEffect(() => {
    const step = puzzle.showMs / puzzle.sequence.length
    setShowing(true)
    setInput([])
    const timers = puzzle.sequence.map((_, i) => setTimeout(() => setFlash(i), i * step))
    timers.push(setTimeout(() => (setShowing(false), setFlash(-1)), puzzle.showMs))
    return () => timers.forEach(clearTimeout)
  }, [puzzle, error])

  const press = (s: BillSymbol) => {
    const next = [...input, s]
    if (puzzle.sequence[next.length - 1] !== s) {
      playSound('error')
      setInput([])
      setRetry(true)
      return
    }
    playSound('vote')
    setRetry(false)
    setInput(next)
    if (next.length === puzzle.sequence.length) onSubmit(next)
  }

  return (
    <div className="bill">
      <div className="bill__sequence" aria-live="polite" data-testid="bill-sequence">
        {puzzle.sequence.map((s, i) => {
          const { icon: Icon, label } = ICONS[s]
          const visible = showing ? flash >= i : i < input.length
          return (
            <span key={i} className={`bill__slot ${showing && flash === i ? 'is-flash' : ''}`} data-symbol={showing ? s : undefined}>
              {visible ? <><Icon size={24} aria-hidden /><small>{label}</small></> : '?'}
            </span>
          )
        })}
      </div>
      <p className="muted">{showing ? 'Memorise the sequence…' : retry ? 'Try again' : `Step ${input.length + 1} of ${puzzle.sequence.length}`}</p>
      <div className="bill__pad">
        {puzzle.symbols.map((s) => {
          const { icon: Icon, label } = ICONS[s]
          return (
            <button key={s} className="bill__btn" disabled={showing || busy} onClick={() => press(s)} data-testid={`bill-symbol-${s}`}>
              <Icon size={30} aria-hidden />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
