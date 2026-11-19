import type { PlayerMatchStats, PublicPlayer } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'
import Badge from 'common/components/Badge'
import PixelPanel from 'common/components/PixelPanel'

export default function RevealTable({ stats, players }: { stats: PlayerMatchStats[]; players: PublicPlayer[] }) {
  return (
    <PixelPanel title="Final reveal">
      <table className="reveal-table">
        <thead>
          <tr><th>MP</th><th>Faction</th><th>Tasks</th><th>Eliminations</th><th>Meetings</th></tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const p = players.find((x) => x.id === s.playerId)
            return (
              <tr key={s.playerId}>
                <td><Avatar avatar={p?.avatar ?? 0} size={28} dead={!s.alive} /> {p?.name ?? '—'}</td>
                <td><Badge tone={s.faction === 'DEEP_STATE' ? 'error' : 'success'}>{s.faction === 'DEEP_STATE' ? 'Deep State' : 'Government'}</Badge></td>
                <td>{s.tasksCompleted}</td>
                <td>{s.eliminations}</td>
                <td>{s.meetingsAttended}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </PixelPanel>
  )
}
