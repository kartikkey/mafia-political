/**
 * Emergency session screen — placeholder until Prompt 6
 * (discussion timer, text chat, voting cards, Skip Vote, results tally).
 */
import { useAppSelector } from 'common/hooks/redux'
import { useMatchNavigation } from 'common/hooks/useMatchNavigation'
import PixelPanel from 'common/components/PixelPanel'
import PhaseTimer from 'components/PhaseTimer/PhaseTimer'
import GameLayout from 'layout/GameLayout'
import PlayerVoteCard from './components/PlayerVoteCard'
import './Meeting.scss'

export default function Meeting() {
  useMatchNavigation()
  const match = useAppSelector((s) => s.game.match)
  const living = match?.players.filter((p) => p.alive && p.connected) ?? []

  return (
    <GameLayout>
      <div className="page meeting">
        <h1>Emergency Session</h1>
        <PhaseTimer label={match?.state ?? 'Meeting'} />
        <PixelPanel title="Lok Sabha">
          <div className="meeting__grid">
            {living.map((p) => <PlayerVoteCard key={p.id} player={p} />)}
          </div>
        </PixelPanel>
      </div>
    </GameLayout>
  )
}
