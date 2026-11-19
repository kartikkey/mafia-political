import { lazy } from 'react'

const Join = lazy(() => import('pages/Join'))

const JoinRoutes = [{ path: '/', element: <Join /> }]

export default JoinRoutes
