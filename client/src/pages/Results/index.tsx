/** Final reveal (Game Design §9, Boards 1 & 2 → End Result). */
import { Crown, Skull } from 'lucide-react'
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import { useMatchNavigation } from 'common/hooks/useMatchNavigation'
import { useCurrentPlayer } from 'common/hooks/useCurrentPlayer'
import PixelButton from 'common/components/PixelButton'
import GameLayout from 'layout/GameLayout'
import { returnToLobby } from 'slices/results/thunk'
import { leaveRoom } from 'slices/join/thunk'
import RevealTable from './components/RevealTable'
import './Results.scss'

export default function Results() {
  useMatchNavigation()
  const dispatch = useAppDispatch()
  const { gameOver, submitLoading, error } = useAppSelector((s) => s.results)
  const match = useAppSelector((s) => s.game.match)
  const players = match?.players ?? []
  const me = useCurrentPlayer()
  const govWon = gameOver?.result === 'GOVERNMENT_WINS'
  const stats = gameOver?.stats ?? []
  const totalElims = stats.reduce((n, s) => n + s.eliminations, 0)

  return (
    <GameLayout>
      <div className={`results ${govWon ? 'results--gov' : 'results--deep'}`} data-testid="results-screen">
        <header className="results__banner" data-testid="results-banner">
          {govWon ? <Crown size={48} aria-hidden /> : <Skull size={48} aria-hidden />}
          <h1 data-testid="results-title">{gameOver ? (govWon ? 'Democracy survives!' : 'The government has fallen!') : 'Session adjourned'}</h1>
          <p>{govWon ? 'The Deep State conspiracy has been exposed.' : 'Parliament has been infiltrated.'}</p>
          <span className="results__winner">{govWon ? 'GOVERNMENT WINS' : 'DEEP STATE WINS'}</span>
        </header>

        <section className="results__summary" data-testid="results-summary">
          <div><strong>{match?.completedTasks ?? 0}/{match?.totalTasks ?? 0}</strong><span>Tasks completed</span></div>
          <div><strong>{totalElims}</strong><span>Eliminations</span></div>
          <div><strong>{stats.filter((s) => s.alive).length}/{stats.length}</strong><span>MPs standing</span></div>
        </section>

        {gameOver && <RevealTable stats={stats} players={players} />}

        <div className="results__actions">
          {me?.isHost ? (
            <PixelButton size="lg" disabled={submitLoading} onClick={() => dispatch(returnToLobby())} data-testid="back-to-lobby-btn">Back to Lobby</PixelButton>
          ) : (
            <p className="muted" data-testid="waiting-for-host">Waiting for host…</p>
          )}
          <PixelButton variant="ghost" onClick={() => dispatch(leaveRoom())} data-testid="results-leave-btn">Leave</PixelButton>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
    </GameLayout>
  )
}
