import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAppSelector } from 'common/hooks/redux'
import { PATHS } from 'constants/routes'

/**
 * Equivalent of AuthProtected for a game: you must have joined a room, and
 * the URL's room code must match it. Otherwise → join screen.
 */
export default function RoomProtected({ children }: { children: ReactNode }) {
  const { roomCode } = useParams()
  const { roomCode: joined, rejoining } = useAppSelector((s) => s.join)
  if (!joined && rejoining) return <div className="page" data-testid="rejoining-screen"><p className="muted">Rejoining your seat…</p></div>
  if (!joined || (roomCode && roomCode.toUpperCase() !== joined)) {
    return <Navigate to={PATHS.join} replace />
  }
  return <>{children}</>
}
