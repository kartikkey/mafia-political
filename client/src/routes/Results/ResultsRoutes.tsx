import { lazy } from 'react'
import RoomProtected from 'routes/RoomProtected'

const Results = lazy(() => import('pages/Results'))

const ResultsRoutes = [
  {
    path: '/results/:roomCode',
    element: (
      <RoomProtected>
        <Results />
      </RoomProtected>
    ),
  },
]

export default ResultsRoutes
