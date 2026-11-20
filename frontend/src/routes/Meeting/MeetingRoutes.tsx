import { lazy } from 'react'
import RoomProtected from 'routes/RoomProtected'

const Meeting = lazy(() => import('pages/Meeting'))

const MeetingRoutes = [
  {
    path: '/meeting/:roomCode',
    element: (
      <RoomProtected>
        <Meeting />
      </RoomProtected>
    ),
  },
]

export default MeetingRoutes
