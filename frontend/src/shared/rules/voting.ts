import type { VoteChoice } from '../types/game'

/**
 * Gameplay Spec §8.4. A player is ejected only if their votes strictly exceed
 * every other option, including Skip. Ties and a Skip plurality → nobody.
 * Missing votes are simply not counted.
 */
export function tallyVotes(votes: Record<string, VoteChoice>): {
  counts: Record<VoteChoice, number>
  ejectedPlayerId: string | null
} {
  const counts: Record<VoteChoice, number> = { SKIP: 0 }
  for (const choice of Object.values(votes)) counts[choice] = (counts[choice] ?? 0) + 1

  let top: VoteChoice | null = null
  let topCount = -1
  let tied = false
  for (const [choice, count] of Object.entries(counts)) {
    if (count > topCount) {
      top = choice
      topCount = count
      tied = false
    } else if (count === topCount) {
      tied = true
    }
  }

  const ejectedPlayerId = !tied && top && top !== 'SKIP' && topCount > 0 ? top : null
  return { counts, ejectedPlayerId }
}
