import { FileSearch } from 'lucide-react'
import type { LeakClue, PublicPlayer } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'

/** Document Leak evidence for the debate: who was last seen at the leaked station. */
export default function LeakClueCard({ clue, players }: { clue: LeakClue; players: PublicPlayer[] }) {
  const p = players.find((x) => x.id === clue.playerId)
  return (
    <div className="leak-clue" role="note" data-testid="leak-clue">
      <FileSearch size={22} aria-hidden />
      {p && <Avatar avatar={p.avatar} size={36} dead={!p.alive} />}
      <p>
        <strong>Leak clue:</strong> <span data-testid="leak-clue-player">{p?.name ?? 'Unknown'}</span> was last seen at the{' '}
        <em>{clue.stationLabel}</em> station when its files leaked.
        {p && !p.alive && ' (since eliminated)'}
      </p>
    </div>
  )
}
