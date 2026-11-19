import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MATCH_SETTINGS } from '@netagiri/shared'
import { useAppDispatch } from 'common/hooks/redux'
import { setFeedback } from 'slices/game/reducer'

interface Action {
  key: string
  label: string
  /** Display hint, e.g. "E" or "SPACE". */
  hotkey?: string
  /** Normalised key names that trigger the action. */
  keys?: string[]
  icon: LucideIcon
  variant: 'primary' | 'green' | 'danger' | 'ghost'
  disabledReason: string | null
  onClick: () => void
}

/**
 * Round contextual action buttons, bottom-right (Board 1 & 2 HUD). Each shows
 * *why* it's disabled ("Too far away", "Cooldown: 8s") rather than just greying out.
 */
export default function ActionBar({ actions, feedback, feedbackAt }: { actions: Action[]; feedback: string | null; feedbackAt: number }) {
  const dispatch = useAppDispatch()
  useEffect(() => {
    if (!feedback) return
    const id = setTimeout(() => dispatch(setFeedback(null)), MATCH_SETTINGS.feedbackMs)
    return () => clearTimeout(id)
  }, [feedback, feedbackAt])

  return (
    <div className="action-bar">
      {feedback && <p className="action-bar__feedback" role="status" data-testid="action-feedback">{feedback}</p>}
      <div className="action-bar__buttons">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <div key={a.key} className="action-bar__slot">
              <button
                className={`round-btn round-btn--${a.variant}`}
                disabled={!!a.disabledReason}
                onClick={a.onClick}
                title={a.disabledReason ?? a.label}
                data-testid={`action-${a.key}`}
              >
                <Icon size={26} strokeWidth={2.5} aria-hidden />
                <span className="round-btn__label">{a.label}</span>
                {a.hotkey && <span className="round-btn__key">{a.hotkey}</span>}
              </button>
              <span className="action-bar__reason" data-testid={`action-${a.key}-reason`}>{a.disabledReason ?? '\u00a0'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { Action }
