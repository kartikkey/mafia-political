/** Per-tab seat claim, kept so a dropped or reloaded tab can rejoin its match. */
export interface Session {
  roomCode: string
  playerId: string
  token: string
}

const KEY = 'netagiri.session'

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(s: Session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
