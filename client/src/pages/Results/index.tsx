/**
 * Final reveal — placeholder until Prompt 8 ("Democracy survives!" /
 * "The government has fallen!", per-player faction, tasks, eliminations).
 */
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import { useMatchNavigation } from 'common/hooks/useMatchNavigation'
import { useCurrentPlayer } from 'common/hooks/useCurrentPlayer'
import PixelButton from 'common/components/PixelButton'
import { returnToLobby } from 'slices/results/thunk'
import RevealTable from './components/RevealTable'

export default function Results() {
  useMatchNavigation()
  const dispatch = useAppDispatch()
  const gameOver = useAppSelector((s) => s.results.gameOver)
  const players = useAppSelector((s) => s.game.match?.players ?? [])
  const me = useCurrentPlayer()
  const govWon = gameOver?.result === 'GOVERNMENT_WINS'

  return (
    <div className="page">
      <h1>{gameOver ? (govWon ? 'Democracy survives!' : 'The government has fallen!') : 'Session adjourned'}</h1>
      {gameOver && <RevealTable stats={gameOver.stats} players={players} />}
      {me?.isHost && <PixelButton onClick={() => dispatch(returnToLobby())}>Back to Lobby</PixelButton>}
    </div>
  )
}
