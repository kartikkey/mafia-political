import PixelButton from 'common/components/PixelButton'

interface Action {
  key: string
  label: string
  hotkey?: string
  variant: 'primary' | 'green' | 'danger' | 'ghost'
  disabledReason: string | null
  onClick: () => void
}

/**
 * Contextual action buttons (Spec §3.2). Each button shows *why* it's
 * disabled ("Too far away", "Cooldown: 8s") rather than just greying out.
 */
export default function ActionBar({ actions, feedback }: { actions: Action[]; feedback: string | null }) {
  return (
    <div className="action-bar">
      {feedback && <p className="action-bar__feedback" role="status">{feedback}</p>}
      <div className="action-bar__buttons">
        {actions.map((a) => (
          <PixelButton key={a.key} variant={a.variant} disabled={!!a.disabledReason} onClick={a.onClick} title={a.disabledReason ?? undefined}>
            {a.label}{a.hotkey && <small> [{a.hotkey}]</small>}
            {a.disabledReason && <span className="action-bar__reason">{a.disabledReason}</span>}
          </PixelButton>
        ))}
      </div>
    </div>
  )
}

export type { Action }
