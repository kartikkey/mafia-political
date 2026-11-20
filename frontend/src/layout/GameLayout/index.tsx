import type { ReactNode } from 'react'
import { WifiOff } from 'lucide-react'
import NewsTicker from 'components/NewsTicker/NewsTicker'
import MuteToggle from 'common/components/MuteToggle'
import { useAppSelector } from 'common/hooks/redux'
import './GameLayout.scss'

/** App shell for in-match screens: breaking-news bar on top, content below. */
export default function GameLayout({ children }: { children: ReactNode }) {
  const reconnecting = useAppSelector((s) => s.join.reconnecting)
  return (
    <div className="game-layout">
      <div className="game-layout__top">
        <NewsTicker />
        <MuteToggle />
      </div>
      {reconnecting && (
        <div className="game-layout__reconnecting" role="status" data-testid="reconnecting-banner">
          <WifiOff size={16} aria-hidden /> Connection lost — reconnecting. Your seat is held for 30 seconds.
        </div>
      )}
      <main className="game-layout__main">{children}</main>
    </div>
  )
}
