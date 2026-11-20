import { useEffect, useRef } from 'react'
import { AVATARS } from 'helpers/avatars'
import { SPRITE_H, SPRITE_W, drawSprite, type SpriteMode } from 'helpers/sprites'

interface Props {
  avatar: number
  size?: number
  dead?: boolean
  label?: string
  mode?: SpriteMode
}

/** Pixel politician portrait drawn with the same sprite code as the map. */
export default function Avatar({ avatar, size = 40, dead = false, label, mode = 'idle' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const a = AVATARS[avatar % AVATARS.length]

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const g = c.getContext('2d')!
    const px = Math.max(1, Math.floor(size / SPRITE_H))
    let frame = 0
    const draw = () => {
      g.clearRect(0, 0, c.width, c.height)
      drawSprite(g, a, Math.floor((size - SPRITE_W * px) / 2), Math.floor((size - SPRITE_H * px) / 2), px, 'down', mode, frame++)
    }
    draw()
    if (mode !== 'meeting') return
    const id = setInterval(draw, 220)
    return () => clearInterval(id)
  }, [avatar, size, mode])

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={`px-avatar ${dead ? 'px-avatar--dead' : ''}`}
      style={{ width: size, height: size }}
      aria-label={label ?? `${a.code} ${a.name}`}
      role="img"
    />
  )
}
