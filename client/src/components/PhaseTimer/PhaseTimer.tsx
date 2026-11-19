import { useCountdown } from 'common/hooks/useCountdown'
import { useAppSelector } from 'common/hooks/redux'

/** Countdown for the current server phase (discussion, voting, role reveal…). */
export default function PhaseTimer({ label }: { label: string }) {
  const endsAt = useAppSelector((s) => s.game.match?.phaseEndsAt)
  const left = useCountdown(endsAt)
  if (!endsAt) return null
  return (
    <span className="phase-timer" aria-live="off">
      {label}: <strong>{left}s</strong>
    </span>
  )
}
