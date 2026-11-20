import { FileWarning } from 'lucide-react'
import { useCountdown } from 'common/hooks/useCountdown'

/** Document Leak: one station offline. Text + icon, not colour alone. */
export default function LeakBanner({ endsAt, station }: { endsAt: number | null; station: string }) {
  const left = useCountdown(endsAt)
  return (
    <div className="leak-banner" role="alert" data-testid="document-leak-banner">
      <FileWarning size={18} aria-hidden /> DOCUMENT LEAK — {station} is offline · {left}s
    </div>
  )
}
