import { useAppSelector } from './redux'

export function useCurrentPlayer() {
  const playerId = useAppSelector((s) => s.join.playerId)
  const players = useAppSelector((s) => s.game.match?.players ?? s.lobby.lobby?.players ?? [])
  return players.find((p) => p.id === playerId) ?? null
}
