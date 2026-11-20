import { Landmark, VenetianMask } from 'lucide-react'
import type { PlayerMatchStats, PublicPlayer } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'
import Badge from 'common/components/Badge'
import PixelPanel from 'common/components/PixelPanel'
import { AVATARS } from 'helpers/avatars'

export default function RevealTable({ stats, players }: { stats: PlayerMatchStats[]; players: PublicPlayer[] }) {
  return (
    <PixelPanel title="Players & roles" className="results__table-panel">
      <table className="reveal-table" data-testid="reveal-table">
        <thead>
          <tr><th>MP</th><th>Faction</th><th>Tasks</th><th>Eliminations</th><th>Meetings</th><th>Status</th></tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const p = players.find((x) => x.id === s.playerId)
            const deep = s.faction === 'DEEP_STATE'
            return (
              <tr key={s.playerId} data-testid={`reveal-row-${s.playerId}`}>
                <td className="reveal-table__mp">
                  <Avatar avatar={p?.avatar ?? 0} size={38} dead={!s.alive} />
                  <span>{p?.name ?? '—'}<small>{AVATARS[(p?.avatar ?? 0) % AVATARS.length].code}</small></span>
                </td>
                <td>
                  <Badge tone={deep ? 'error' : 'success'}>
                    {deep ? <VenetianMask size={10} aria-hidden /> : <Landmark size={10} aria-hidden />} {deep ? 'Deep State' : 'Government'}
                  </Badge>
                </td>
                <td>{s.tasksCompleted}</td>
                <td>{s.eliminations}</td>
                <td>{s.meetingsAttended}</td>
                <td>{s.alive ? 'Alive' : s.ejected ? 'Voted out' : p && !p.connected ? 'Left' : 'Eliminated'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </PixelPanel>
  )
}
