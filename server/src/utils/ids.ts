import { randomUUID } from 'node:crypto'
import { ROOM_CODE_LENGTH } from '@netagiri/shared'

// No 0/O/1/I to keep codes easy to read aloud during a demo.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeRoomCode(exists: (code: string) => boolean): string {
  let code: string
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
  } while (exists(code))
  return code
}

export const makeId = () => randomUUID()

export function sanitiseName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16)
  return name.length >= 2 ? name : null
}
