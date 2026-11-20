import { Suspense } from 'react'
import { useRoutes } from 'react-router-dom'
import allRoutes from 'routes/allRoutes'

export default function App() {
  const element = useRoutes(allRoutes)
  return <Suspense fallback={<div className="page muted">Loading Parliament…</div>}>{element}</Suspense>
}
