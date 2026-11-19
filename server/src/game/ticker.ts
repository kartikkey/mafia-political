/** Per-room server tick: records replay frames and drives computer players. */
import { MATCH_SETTINGS } from '@netagiri/shared'
import type { IO } from '../handlers/types'
import { runBots } from './bots'
import type { Match } from './Match'

export function startTicker(io: IO, match: Match) {
  let last = Date.now()
  match.tickTimer = setInterval(() => {
    const now = Date.now()
    match.recordFrame(now)
    if (match.inMatch) runBots(io, match, now, now - last)
    last = now
  }, MATCH_SETTINGS.botTickMs)
}
