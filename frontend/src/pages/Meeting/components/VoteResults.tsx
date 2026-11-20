import type { PublicPlayer, VoteTally } from '@netagiri/shared'
import Badge from 'common/components/Badge'

/** VOTE_RESULTS: tally bars per option incl. Skip + ejected faction reveal (Spec §8.3–8.4). */
export default function VoteResults({ tally, players }: { tally: VoteTally; players: PublicPlayer[] }) {
  const name = (id: string) => (id === 'SKIP' ? 'Skip Vote' : (players.find((p) => p.id === id)?.name ?? '?'))
  const rows = Object.entries(tally.counts).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...rows.map(([, c]) => c))
  const ejected = tally.ejectedPlayerId ? players.find((p) => p.id === tally.ejectedPlayerId) : null
  const deep = tally.ejectedFaction === 'DEEP_STATE'

  return (
    <div className="vote-results" data-testid="vote-results">
      <ul className="vote-results__bars">
        {rows.map(([id, count]) => (
          <li key={id}>
            <span className="vote-results__label">{name(id)}</span>
            <span className="vote-results__bar"><span style={{ width: `${(count / max) * 100}%` }} /></span>
            <strong>{count}</strong>
          </li>
        ))}
      </ul>
      {ejected ? (
        <p className="vote-results__verdict" data-testid="vote-results-verdict">
          {ejected.name} was voted out —{' '}
          <Badge tone={deep ? 'error' : 'success'}>{deep ? 'was Deep State' : 'was NOT Deep State (Government)'}</Badge>
        </p>
      ) : (
        <p className="vote-results__verdict" data-testid="vote-results-verdict">No majority — nobody was removed.</p>
      )}
    </div>
  )
}
