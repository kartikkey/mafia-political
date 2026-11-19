import { Users } from 'lucide-react'
import type { PublicPlayer } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'

/** Top-right HUD: living count + roster (never factions of living players). */
export default function PlayersAlive({ players }: { players: PublicPlayer[] }) {
  const living = players.filter((p) => p.alive && p.connected)
  return (
    <aside className="hud hud--players" data-testid="hud-players">
      <h2 className="hud__title"><Users size={14} aria-hidden /> <span data-testid="players-alive-count">{living.length}</span> Players Alive</h2>
      <ul className="hud__roster">
        {players.map((p) => (
          <li key={p.id} className={!p.alive || !p.connected ? 'is-out' : ''}>
            <Avatar avatar={p.avatar} size={22} dead={!p.alive} />
            <span>{p.name}</span>
            {!p.connected ? <small>left</small> : !p.alive && <small>out</small>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
