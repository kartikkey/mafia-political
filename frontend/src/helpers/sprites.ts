/**
 * 16-bit politician sprites drawn in code on a 12×18 pixel grid.
 * Modes follow the sprite sheet: idle (4f), walk (4 dirs × 4f), interact (3f),
 * eliminated (4f), meeting/talking (4f).
 */
import type { Direction } from '@netagiri/shared'
import type { AvatarDef } from './avatars'

export type SpriteMode = 'idle' | 'walk' | 'interact' | 'eliminated' | 'meeting'

export const SPRITE_W = 12
export const SPRITE_H = 18

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`
}

/**
 * Draw a character with its top-left at (ox, oy); `px` is the size of one sprite pixel.
 */
export function drawSprite(g: CanvasRenderingContext2D, a: AvatarDef, ox: number, oy: number, px: number, facing: Direction, mode: SpriteMode, frame: number) {
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c
    g.fillRect(ox + x * px, oy + y * px, w * px, h * px)
  }
  const f = frame % 4
  const bob = mode === 'idle' && f === 2 ? 1 : 0
  const step = mode === 'walk' ? [0, 1, 0, -1][f] : 0
  const dark = shade(a.outfit, -45)
  const ink = '#14100c'

  // legs / feet (walk alternates)
  const legC = a.style === 'kurta' || a.style === 'nehru' ? '#efe9da' : a.style === 'saree' ? a.outfit : '#22252b'
  r(3, 15 + Math.max(0, step), 2, 3 - Math.max(0, step), legC)
  r(7, 15 + Math.max(0, -step), 2, 3 - Math.max(0, -step), legC)
  r(3, 17, 2, 1, ink)
  r(7, 17, 2, 1, ink)

  // torso
  const torsoBottom = a.style === 'kurta' || a.style === 'saree' ? 16 : 15
  r(2, 8 + bob, 8, torsoBottom - 8 - bob, a.outfit)
  r(2, 8 + bob, 1, torsoBottom - 8 - bob, dark)
  if (facing !== 'up') {
    if (a.style === 'suit') {
      r(5, 8 + bob, 2, 1, '#f4f1ea')
      r(5, 9 + bob, 2, 3, a.accent) // tie
    } else if (a.style === 'nehru') {
      r(5, 8 + bob, 2, 6, a.accent) // button placket
    } else if (a.style === 'saree') {
      r(6, 8 + bob, 3, 8, a.accent) // pallu drape
    } else if (a.style === 'shirt') {
      r(5, 8 + bob, 2, 1, a.accent)
    } else {
      r(5, 8 + bob, 1, 4, a.accent)
    }
  }

  // arms
  const armY = 9 + bob
  if (mode === 'interact') {
    const lift = [0, 2, 3][frame % 3]
    r(1, armY, 1, 4, dark)
    r(10, armY - lift, 1, 4, dark)
    r(10, armY - lift - 1, 1, 1, a.skin)
  } else {
    r(1, armY + (step > 0 ? 1 : 0), 1, 5, dark)
    r(10, armY + (step < 0 ? 1 : 0), 1, 5, dark)
    r(1, armY + 5, 1, 1, a.skin)
    r(10, armY + 5, 1, 1, a.skin)
  }

  // head
  const hy = 2 + bob
  r(3, hy, 6, 6, a.skin)
  r(3, hy, 6, 2, a.hair)
  if (facing === 'up') r(3, hy, 6, 5, a.hair)
  if (facing === 'left') r(7, hy, 2, 4, a.hair)
  if (facing === 'right') r(3, hy, 2, 4, a.hair)
  if (a.style === 'saree') r(2, hy + 1, 1, 6, a.hair)
  if (a.cap) r(3, hy - 1, 6, 2, a.cap)

  if (facing !== 'up') {
    const eyes = facing === 'down' ? [4, 7] : facing === 'left' ? [4] : [7]
    for (const ex of eyes) r(ex, hy + 3, 1, 1, ink)
    if (a.glasses) for (const ex of eyes) r(ex - 0.5, hy + 2.6, 2, 0.4, ink)
    const talking = mode === 'meeting' && f % 2 === 1
    if (facing === 'down') r(5, hy + 5, 2, talking ? 1 : 0.5, talking ? '#5a1e18' : shade(a.skin, -50))
  }

  // outline hint
  g.strokeStyle = 'rgba(0,0,0,0.55)'
  g.lineWidth = Math.max(1, px / 2)
  g.strokeRect(ox + 2 * px, oy + 8 * px, 8 * px, (torsoBottom - 8) * px)
}

/** Body marker: sprite lying flat, greyed, with an eliminated "fade" frame. */
export function drawBody(g: CanvasRenderingContext2D, a: AvatarDef, cx: number, cy: number, px: number, frame: number) {
  g.save()
  g.translate(cx, cy)
  g.rotate(Math.PI / 2)
  g.globalAlpha = 0.85 - (frame % 4) * 0.05
  // Pre-greyed palette instead of ctx.filter (filters are very slow on software canvases).
  const grey = (hex: string) => shade('#777777', (parseInt(hex.slice(1, 3), 16) - 128) / 3)
  const ghost: AvatarDef = { ...a, outfit: grey(a.outfit), accent: grey(a.accent), skin: '#9a948a', hair: '#555', cap: a.cap && '#bbb' }
  drawSprite(g, ghost, (-SPRITE_W * px) / 2, (-SPRITE_H * px) / 2, px, 'down', 'idle', 0)
  g.restore()
  g.fillStyle = '#a8463d'
  g.fillRect(cx - 3 * px, cy - px / 2, 6 * px, px)
}
