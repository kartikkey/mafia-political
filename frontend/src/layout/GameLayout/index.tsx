import type { ReactNode } from 'react'
import NewsTicker from 'components/NewsTicker/NewsTicker'
import MuteToggle from 'common/components/MuteToggle'
import './GameLayout.scss'

/** App shell for in-match screens: breaking-news bar on top, content below. */
export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <div className="game-layout">
      <div className="game-layout__top">
        <NewsTicker />
        <MuteToggle />
      </div>
      <main className="game-layout__main">{children}</main>
    </div>
  )
}
