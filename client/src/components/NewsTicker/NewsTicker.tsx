import { useEffect, useState } from 'react'
import { MATCH_SETTINGS, NEWS } from '@netagiri/shared'
import { useAppSelector } from 'common/hooks/redux'
import './NewsTicker.scss'

/** Breaking-news strip at the top of every in-match screen (Game Design §8). */
export default function NewsTicker() {
  const latest = useAppSelector((s) => s.game.news.at(-1))
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!latest) return
    setVisible(true)
    const id = setTimeout(() => setVisible(false), MATCH_SETTINGS.newsTickerMs)
    return () => clearTimeout(id)
  }, [latest?.at])

  return (
    <div className={`news-ticker ${visible ? 'news-ticker--live' : ''}`} role="status" aria-live="polite">
      <span className="news-ticker__tag">NEWS</span>
      <span className="news-ticker__text">{latest && visible ? NEWS[latest.key] : 'Parliament is in session.'}</span>
    </div>
  )
}
