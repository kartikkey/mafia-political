import { Zap } from 'lucide-react'
import { useCountdown } from 'common/hooks/useCountdown'

/** Power Cut: red warning banner + light vignette, never blocks play (Spec §7.2). */
export default function PowerCutOverlay({ restoreAt, deep }: { restoreAt: number | null; deep: boolean }) {
  const left = useCountdown(restoreAt)
  return (
    <>
      <div className="power-vignette" aria-hidden />
      <div className="power-banner" role="alert" data-testid="power-cut-banner">
        <Zap size={18} aria-hidden /> POWER CUT — {deep ? 'MPs are in the dark' : 'Restore it at the Central Hall power panel'} · {left}s
      </div>
    </>
  )
}
