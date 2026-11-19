import type { PublicPlayer } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'

interface Props {
  player: PublicPlayer
  selected?: boolean
  voted?: boolean
  disabled?: boolean
  onSelect?: () => void
}

export default function PlayerVoteCard({ player, selected, voted, disabled, onSelect }: Props) {
  return (
    <button className={`vote-card ${selected ? 'is-selected' : ''}`} disabled={disabled || !onSelect} onClick={onSelect}>
      <Avatar avatar={player.avatar} size={40} dead={!player.alive} />
      <span>{player.name}</span>
      {voted && <span className="vote-card__voted">VOTED</span>}
    </button>
  )
}
