import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathForState } from 'constants/routes'
import { useAppSelector } from './redux'

/**
 * Keep the URL in sync with the authoritative match state. Every in-room
 * page calls this once; the server decides which screen players see.
 */
export function useMatchNavigation() {
  const navigate = useNavigate()
  const roomCode = useAppSelector((s) => s.join.roomCode)
  const matchState = useAppSelector((s) => s.game.match?.state)

  useEffect(() => {
    if (!roomCode) return
    const target = pathForState(matchState ?? 'WAITING', roomCode)
    if (location.pathname !== target) navigate(target, { replace: true })
  }, [roomCode, matchState])
}
