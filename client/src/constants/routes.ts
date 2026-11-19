import type { MatchState } from '@netagiri/shared'

/** URL builders. Slugs are kebab-case; room code is the only param. */
export const PATHS = {
  join: '/',
  lobby: (code: string) => `/lobby/${code}`,
  game: (code: string) => `/game/${code}`,
  meeting: (code: string) => `/meeting/${code}`,
  results: (code: string) => `/results/${code}`,
} as const

/** Which page a client should be on for each server match state. */
export function pathForState(state: MatchState, code: string): string {
  switch (state) {
    case 'WAITING':
      return PATHS.lobby(code)
    case 'ROLE_ASSIGNMENT':
    case 'PLAYING':
      return PATHS.game(code)
    case 'MEETING_TRANSITION':
    case 'DISCUSSION':
    case 'VOTING':
    case 'VOTE_RESULTS':
      return PATHS.meeting(code)
    case 'GAME_OVER':
      return PATHS.results(code)
  }
}
