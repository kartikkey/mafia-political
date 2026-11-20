import { useEffect, useState } from 'react'
import { MATCH_SETTINGS, NEWS } from '@netagiri/shared'
import { useAppSelector } from 'common/hooks/redux'
import './NewsTicker.scss'

/** Breaking-news strip at the top of every in-match screen (Game Design §8, Appendix A). */
export default function NewsTicker() {
  const latest = useAppSelector((s) => s.game.news.at(-1))
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!latest) return
    setVisible(true)
    const id = setTimeout(() => setVisible(false), MATCH_SETTINGS.newsTickerMs)
    return () => clearTimeout(id)
  }, [latest?.at, latest?.key])

  const live = !!latest && visible
  return (
    <div className={`news-ticker ${live ? 'news-ticker--live' : ''}`} role="status" aria-live="polite" data-testid="news-ticker">
      <span className="news-ticker__tag">{live ? 'BREAKING' : 'NEWS'}</span>
      <span className="news-ticker__window">
        <span key={latest?.at} className="news-ticker__text" data-testid="news-ticker-text">
          {live ? NEWS[latest.key] : 'Parliament is in session. Every MP is a suspect.'}
        </span>
      </span>
    </div>
  )
}
