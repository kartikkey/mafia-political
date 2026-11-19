import { AVATARS } from 'helpers/avatars'

interface Props {
  avatar: number
  size?: number
  dead?: boolean
  label?: string
}

/** Placeholder politician bust until pixel sprites land in assets/images. */
export default function Avatar({ avatar, size = 40, dead = false, label }: Props) {
  const a = AVATARS[avatar % AVATARS.length]
  return (
    <span className={`px-avatar ${dead ? 'px-avatar--dead' : ''}`} style={{ width: size, height: size }} aria-label={label ?? a.name} role="img">
      <span className="px-avatar__head" />
      <span className="px-avatar__body" style={{ background: a.outfit, borderColor: a.accent }} />
    </span>
  )
}
