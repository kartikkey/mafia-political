import { useRef, useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'
import PixelButton from 'common/components/PixelButton'

export default function InviteLink({ code }: { code: string }) {
  const link = `${window.location.origin}/?room=${code}`
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)
  const box = useRef<HTMLInputElement>(null)
  const canShare = typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setManual(true)
      setTimeout(() => box.current?.select(), 0)
    }
  }
  const share = () => navigator.share({ title: 'NETAGIRI', text: `Join my Parliament session (room ${code})`, url: link }).catch(() => {})

  return (
    <div className="invite">
      <div className="invite__actions">
        <PixelButton variant="green" onClick={copy} data-testid="copy-invite-link-btn">
          {copied ? <><Check size={14} /> Link copied</> : <><Link2 size={14} /> Copy invite link</>}
        </PixelButton>
        {canShare && (
          <PixelButton variant="ghost" onClick={share} data-testid="share-invite-link-btn"><Share2 size={14} /> Share</PixelButton>
        )}
      </div>
      {manual && <input ref={box} className="invite__box" readOnly value={link} onFocus={(e) => e.target.select()} data-testid="invite-link-box" />}
    </div>
  )
}
