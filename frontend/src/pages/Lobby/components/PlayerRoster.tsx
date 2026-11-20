import type { PublicPlayer } from '@netagiri/shared'
import { UserX, X } from 'lucide-react'
import Avatar from 'common/components/Avatar'
import Badge from 'common/components/Badge'

interface Props {
  players: PublicPlayer[]
  meId: string | null
  maxPlayers: number
  /** Host only: remove a single computer player. */
  onRemoveBot?: (id: string) => void
  /** Host only: remove a human player (they may join again). */
  onKick?: (id: string) => void
}

export default function PlayerRoster({ players, meId, maxPlayers, onRemoveBot, onKick }: Props) {
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
          {!p.isBot && p.id !== meId && onKick && (
            <button type="button" className="roster__remove" onClick={() => onKick(p.id)} aria-label={`Remove ${p.name} from the lobby`} title={`Remove ${p.name} from the lobby`} data-testid={`kick-player-${p.id}`}>
              <UserX size={16} strokeWidth={2.5} />
            </button>
          )}
          {p.isBot && onRemoveBot && (
            <button type="button" className="roster__remove" onClick={() => onRemoveBot(p.id)} aria-label={`Remove ${p.name}`} title={`Remove ${p.name}`} data-testid={`remove-bot-${p.id}`}>
              <X size={16} strokeWidth={3} />
            </button>
          )}
        </li>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <li key={`empty-${i}`} className="roster__row roster__row--empty">Waiting for MP…</li>
      ))}
    </ul>
  )
}
