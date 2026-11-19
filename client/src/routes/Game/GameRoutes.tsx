import { lazy } from 'react'
import RoomProtected from 'routes/RoomProtected'

const Game = lazy(() => import('pages/Game'))

const GameRoutes = [
  {
    path: '/game/:roomCode',
    element: (
      <RoomProtected>
        <Game />
      </RoomProtected>
    ),
  },
]

export default GameRoutes
