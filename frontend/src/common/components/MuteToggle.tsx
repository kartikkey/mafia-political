import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { isMuted, setMuted } from 'helpers/sound'

/** Sound on/off, persisted in localStorage. Icon + text label (Spec §11.4). */
export default function MuteToggle() {
  const [muted, setLocal] = useState(isMuted)
  const toggle = () => {
    setMuted(!muted)
    setLocal(!muted)
  }
  return (
    <button className="mute-toggle" onClick={toggle} aria-pressed={muted} data-testid="mute-toggle">
      {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
      <span>{muted ? 'Sound off' : 'Sound on'}</span>
    </button>
  )
}
