import { lazy } from 'react'
import RoomProtected from 'routes/RoomProtected'

const Lobby = lazy(() => import('pages/Lobby'))

const LobbyRoutes = [
  {
    path: '/lobby/:roomCode',
    element: (
      <RoomProtected>
        <Lobby />
      </RoomProtected>
    ),
  },
]

export default LobbyRoutes
