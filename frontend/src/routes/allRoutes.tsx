// Imports + spreads only — never define routes inline here.
import { Navigate } from 'react-router-dom'
import JoinRoutes from './Join/JoinRoutes'
import LobbyRoutes from './Lobby/LobbyRoutes'
import GameRoutes from './Game/GameRoutes'
import MeetingRoutes from './Meeting/MeetingRoutes'
import ResultsRoutes from './Results/ResultsRoutes'

const allRoutes = [
  ...JoinRoutes,
  ...LobbyRoutes,
  ...GameRoutes,
  ...MeetingRoutes,
  ...ResultsRoutes,
  { path: '*', element: <Navigate to="/" replace /> },
]

export default allRoutes
