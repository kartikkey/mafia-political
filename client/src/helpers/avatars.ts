/**
 * The 8 playable politician variations — character sprite sheet A1–A8
 * (docs/references/extra/character-sprite-sheet-a1-a8.webp, Board 1 → Characters).
 * Colours drive the placeholder canvas sprites until real sprites land in
 * assets/images/sprites/ (Idle 4f · Walk 4 dirs × 4f · Interact 3f · Eliminated 4f · Meeting 4f).
 */
export interface AvatarDef {
  code: string
  name: string
  outfit: string
  accent: string
  glasses: boolean
}

export const AVATARS: AvatarDef[] = [
  { code: 'A1', name: 'Suit (Navy)', outfit: '#2b3f73', accent: '#c0392b', glasses: false },
  { code: 'A2', name: 'Suit (Black)', outfit: '#1e1e22', accent: '#c0392b', glasses: true },
  { code: 'A3', name: 'Kurta (White)', outfit: '#efe9da', accent: '#d8c8a4', glasses: true },
  { code: 'A4', name: 'Nehru (Blue)', outfit: '#24407a', accent: '#efe9da', glasses: false },
  { code: 'A5', name: 'Suit (Grey)', outfit: '#6b6f78', accent: '#2b3f73', glasses: true },
  { code: 'A6', name: 'Shirt (White)', outfit: '#f4f1ea', accent: '#3a3a3a', glasses: false },
  { code: 'A7', name: 'Blazer (Brown)', outfit: '#8a5528', accent: '#efe9da', glasses: true },
  { code: 'A8', name: 'Nehru (Green)', outfit: '#3f7d4e', accent: '#efe9da', glasses: true },
]
