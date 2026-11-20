import type { PublicPlayer } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'
import Badge from 'common/components/Badge'

interface Props {
  players: PublicPlayer[]
  meId: string | null
  maxPlayers: number
}

export default function PlayerRoster({ players, meId, maxPlayers }: Props) {
  const empty = Math.max(0, maxPlayers - players.length)
  return (
    <ul className="roster">
      {players.map((p) => (
        <li key={p.id} className={`roster__row ${p.id === meId ? 'is-me' : ''}`}>
          <Avatar avatar={p.avatar} size={36} />
          <span className="roster__name">{p.name}{p.id === meId && ' (you)'}</span>
          {p.isHost && <Badge tone="warning">Host</Badge>}
          {p.isBot && <span data-testid={`roster-bot-${p.id}`}><Badge tone="info">BOT</Badge></span>}
          <Badge tone={p.connected ? 'success' : 'error'}>{p.connected ? 'Ready' : 'Away'}</Badge>
        </li>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <li key={`empty-${i}`} className="roster__row roster__row--empty">Waiting for MP…</li>
      ))}
    </ul>
  )
}
