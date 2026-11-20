import { Check } from 'lucide-react'
import type { PublicPlayer } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'

interface Props {
  player: PublicPlayer
  isMe: boolean
  selected?: boolean
  voted?: boolean
  disabled?: boolean
  onSelect?: () => void
}

/** Portrait card. Dead/left players are greyed with a text label (never colour alone). */
export default function PlayerVoteCard({ player, isMe, selected, voted, disabled, onSelect }: Props) {
  const out = !player.alive || !player.connected
  return (
    <button
      className={`vote-card ${selected ? 'is-selected' : ''} ${out ? 'is-out' : ''}`}
      disabled={disabled || !onSelect}
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`vote-card-${player.id}`}
    >
      <Avatar avatar={player.avatar} size={44} dead={!player.alive} mode={out ? 'idle' : 'meeting'} />
      <span className="vote-card__name">
        {player.name}
        {isMe && <small> (you)</small>}
        {!player.alive && <small className="vote-card__status">ELIMINATED</small>}
        {player.alive && !player.connected && <small className="vote-card__status">LEFT</small>}
        {player.alive && player.connected && player.reconnecting && <small className="vote-card__status" data-testid={`vote-card-reconnecting-${player.id}`}>RECONNECTING</small>}
      </span>
      {voted && <span className="vote-card__voted" data-testid={`vote-card-voted-${player.id}`}><Check size={12} aria-hidden /> VOTED</span>}
    </button>
  )
}
