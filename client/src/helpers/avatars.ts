/**
 * The 8 playable politician variations — character sprite sheet A1–A8
 * (docs/references/extra/character-sprite-sheet-a1-a8.webp, Board 1 → Characters).
 * Drawn in code by helpers/sprites.ts (Idle 4f · Walk 4 dirs × 4f · Interact 3f · Eliminated 4f · Meeting 4f).
 */
export interface AvatarDef {
  code: string
  name: string
  outfit: string
  accent: string
  glasses: boolean
  skin: string
  hair: string
  /** kurta = long tunic; suit = jacket + tie; nehru = high-collar jacket over kurta; saree = drape */
  style: 'kurta' | 'suit' | 'nehru' | 'saree' | 'shirt'
  cap?: string
}

export const AVATARS: AvatarDef[] = [
  { code: 'A1', name: 'Suit (Navy)', outfit: '#2b3f73', accent: '#c0392b', glasses: false, skin: '#c68b5e', hair: '#1d1410', style: 'suit' },
  { code: 'A2', name: 'Suit (Black)', outfit: '#1e1e22', accent: '#c0392b', glasses: true, skin: '#a8714a', hair: '#d9d4c7', style: 'suit' },
  { code: 'A3', name: 'Kurta (White)', outfit: '#efe9da', accent: '#d8c8a4', glasses: true, skin: '#b97d52', hair: '#cfc9bb', style: 'kurta', cap: '#f7f4ec' },
  { code: 'A4', name: 'Saree (Blue)', outfit: '#24407a', accent: '#f2c14e', glasses: false, skin: '#c68b5e', hair: '#1d1410', style: 'saree' },
  { code: 'A5', name: 'Suit (Grey)', outfit: '#6b6f78', accent: '#2b3f73', glasses: true, skin: '#d29a6c', hair: '#3a2a20', style: 'suit' },
  { code: 'A6', name: 'Shirt (White)', outfit: '#f4f1ea', accent: '#3a3a3a', glasses: false, skin: '#9c6640', hair: '#1d1410', style: 'shirt' },
  { code: 'A7', name: 'Bandhgala (Brown)', outfit: '#8a5528', accent: '#efe9da', glasses: true, skin: '#c68b5e', hair: '#5a4030', style: 'nehru' },
  { code: 'A8', name: 'Nehru (Green)', outfit: '#3f7d4e', accent: '#efe9da', glasses: true, skin: '#b97d52', hair: '#8a8478', style: 'nehru', cap: '#f7f4ec' },
]
