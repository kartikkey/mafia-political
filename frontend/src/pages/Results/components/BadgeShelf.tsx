import { Award, Eye, FileCheck, Megaphone, Shield, VenetianMask, Zap, type LucideIcon } from 'lucide-react'
import { BADGES, computeBadges, type BadgeId, type PlayerMatchStats, type PublicPlayer } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'
import PixelPanel from 'common/components/PixelPanel'

const ICONS: Record<BadgeId, LucideIcon> = {
  BILL_PASSER: FileCheck,
  MASTER_BLUFFER: VenetianMask,
  SILENT_ASSASSIN: Award,
  SHARP_EYE: Eye,
  FIRST_RESPONDER: Megaphone,
  POWER_BROKER: Zap,
  SURVIVOR: Shield,
}

/** End-of-match achievement badges (computed from the final stats). */
export default function BadgeShelf({ stats, players }: { stats: PlayerMatchStats[]; players: PublicPlayer[] }) {
  const awarded = computeBadges(stats)
  if (!awarded.length) return null
  // One card per badge; ties list every winner.
  const groups = (Object.keys(BADGES) as BadgeId[])
    .map((badge) => ({ badge, winners: awarded.filter((a) => a.badge === badge).map((a) => players.find((p) => p.id === a.playerId)) }))
    .filter((g) => g.winners.length)
  return (
    <PixelPanel title="Badges" className="results__badges-panel">
      <ul className="badge-shelf" data-testid="badge-shelf">
        {groups.map(({ badge, winners }) => {
          const Icon = ICONS[badge]
          return (
            <li key={badge} className={`badge-card badge-card--${badge.toLowerCase()}`} data-testid={`badge-${badge}`}>
              <Icon size={26} aria-hidden className="badge-card__icon" />
              <div>
                <strong>{BADGES[badge].label}</strong>
                <span className="badge-card__who">
                  {winners.map((p, i) => (
                    <span key={p?.id ?? i} className="badge-card__winner"><Avatar avatar={p?.avatar ?? 0} size={22} /> {p?.name ?? '—'}</span>
                  ))}
                </span>
                <small>{BADGES[badge].description}</small>
              </div>
            </li>
          )
        })}
      </ul>
    </PixelPanel>
  )
}
