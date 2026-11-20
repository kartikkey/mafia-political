import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import { useMatchNavigation } from 'common/hooks/useMatchNavigation'
import PixelButton from 'common/components/PixelButton'
import MuteToggle from 'common/components/MuteToggle'
import PixelPanel from 'common/components/PixelPanel'
import { addBots, kickPlayer, removeBot, removeBots, startGame } from 'slices/lobby/thunk'
import InviteLink from './components/InviteLink'
import { leaveRoom } from 'slices/join/thunk'
import RoomCodeCard from './components/RoomCodeCard'
import PlayerRoster from './components/PlayerRoster'
import './Lobby.scss'

export default function Lobby() {
  useMatchNavigation()
  const dispatch = useAppDispatch()
  const { playerId, roomCode } = useAppSelector((s) => s.join)
  const { lobby, submitLoading, error } = useAppSelector((s) => s.lobby)

  const players = lobby?.players ?? []
  const isHost = lobby?.hostId === playerId
  const min = lobby?.minPlayers ?? 6
  const enough = players.length >= min
  const bots = players.filter((p) => p.isBot).length

  return (
    <div className="page lobby">
      <div className="page-corner"><MuteToggle /></div>
      <h1>NETAGIRI</h1>
      <div className="lobby__grid">
        <PixelPanel title={`Members of Parliament (${players.length}/${lobby?.maxPlayers ?? 10})`}>
          <PlayerRoster players={players} meId={playerId} maxPlayers={lobby?.maxPlayers ?? 10} onRemoveBot={isHost ? (id) => dispatch(removeBot(id)) : undefined} onKick={isHost ? (id) => dispatch(kickPlayer(id)) : undefined} />
        </PixelPanel>

        <PixelPanel title="Session">
          {roomCode && <RoomCodeCard code={roomCode} />}
          {roomCode && <InviteLink code={roomCode} />}
          <p className="muted">
            {enough ? 'Quorum reached.' : `Need ${min - players.length} more MP${min - players.length === 1 ? '' : 's'} (min ${min}).`}
          </p>
          {isHost ? (
            <>
              <PixelButton size="lg" disabled={!enough || submitLoading} onClick={() => dispatch(startGame())} data-testid="start-game-btn">
                Start Game
              </PixelButton>
              <div className="lobby__bots">
                {!enough && (
                  <PixelButton variant="green" onClick={() => dispatch(addBots())} data-testid="add-bots-btn">
                    Fill {min - players.length} seat{min - players.length === 1 ? '' : 's'} with bots
                  </PixelButton>
                )}
                {bots > 0 && (
                  <PixelButton variant="ghost" onClick={() => dispatch(removeBots())} data-testid="remove-bots-btn">
                    Remove {bots} bot{bots === 1 ? '' : 's'}
                  </PixelButton>
                )}
              </div>
              {bots > 0 && <p className="muted">Computer players follow the same rules. Real MPs who join take a bot's seat.</p>}
            </>
          ) : (
            <p>Waiting for the host to start…</p>
          )}
          {error && <p className="error-text" role="alert">{error}</p>}
          <PixelButton variant="ghost" onClick={() => dispatch(leaveRoom())} data-testid="lobby-leave-btn">Leave</PixelButton>
        </PixelPanel>
      </div>
    </div>
  )
}
