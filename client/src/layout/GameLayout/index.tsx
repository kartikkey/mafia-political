import type { ReactNode } from 'react'
import NewsTicker from 'components/NewsTicker/NewsTicker'
import './GameLayout.scss'

/** App shell for in-match screens: news ticker on top, content below. */
export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <div className="game-layout">
      <NewsTicker />
      <main className="game-layout__main">{children}</main>
    </div>
  )
}
