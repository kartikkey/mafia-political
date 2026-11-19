/** End-of-match achievement badges, computed from final match stats. */
import type { PlayerMatchStats } from '../types/game'

export type BadgeId = 'BILL_PASSER' | 'MASTER_BLUFFER' | 'SILENT_ASSASSIN' | 'SHARP_EYE' | 'FIRST_RESPONDER' | 'POWER_BROKER' | 'SURVIVOR'

export const BADGES: Record<BadgeId, { label: string; description: string }> = {
  BILL_PASSER: { label: 'Bill Passer', description: 'Most tasks completed for the Government' },
  MASTER_BLUFFER: { label: 'Master Bluffer', description: 'Deep State agent who faked the most tasks and was never voted out' },
  SILENT_ASSASSIN: { label: 'Silent Assassin', description: 'Most eliminations' },
  SHARP_EYE: { label: 'Sharp Eye', description: 'Most votes cast against Deep State agents' },
  FIRST_RESPONDER: { label: 'First Responder', description: 'Reported the most bodies' },
  POWER_BROKER: { label: 'Power Broker', description: 'Restored the power at the panel' },
  SURVIVOR: { label: 'Survivor', description: 'Government MP still standing at the end' },
}

export interface AwardedBadge {
  playerId: string
  badge: BadgeId
}

/** Top scorer (> 0) for a metric; ties share the badge. */
function top(stats: PlayerMatchStats[], metric: (s: PlayerMatchStats) => number, badge: BadgeId): AwardedBadge[] {
  const best = Math.max(0, ...stats.map(metric))
  return best > 0 ? stats.filter((s) => metric(s) === best).map((s) => ({ playerId: s.playerId, badge })) : []
}

export function computeBadges(stats: PlayerMatchStats[]): AwardedBadge[] {
  const gov = stats.filter((s) => s.faction === 'GOVERNMENT')
  const deep = stats.filter((s) => s.faction === 'DEEP_STATE')
  return [
    ...top(gov, (s) => s.tasksCompleted, 'BILL_PASSER'),
    ...top(deep.filter((s) => !s.ejected), (s) => s.fakeTasks ?? 0, 'MASTER_BLUFFER'),
    ...top(deep, (s) => s.eliminations, 'SILENT_ASSASSIN'),
    ...top(stats, (s) => s.votesOnAgents ?? 0, 'SHARP_EYE'),
    ...top(stats, (s) => s.reports ?? 0, 'FIRST_RESPONDER'),
    ...stats.filter((s) => (s.powerRepairs ?? 0) > 0).map((s) => ({ playerId: s.playerId, badge: 'POWER_BROKER' as const })),
    ...gov.filter((s) => s.alive).map((s) => ({ playerId: s.playerId, badge: 'SURVIVOR' as const })),
  ]
}
