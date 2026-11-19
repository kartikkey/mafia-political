import { useState } from 'react'
import PixelButton from 'common/components/PixelButton'

export default function RoomCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — code is visible anyway */
    }
  }
  return (
    <div className="room-code">
      <span className="muted">Room code</span>
      <strong className="room-code__value">{code}</strong>
      <PixelButton variant="ghost" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</PixelButton>
    </div>
  )
}
