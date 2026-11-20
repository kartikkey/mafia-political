import { useEffect, type ReactNode } from 'react'
import PixelPanel from './PixelPanel'

interface Props {
  title: string
  onClose?: () => void
  children: ReactNode
}

/** Overlay used for task mini-games (Spec §6: modal over the map). Esc closes. */
export default function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-label={title}>
      <PixelPanel title={title} className="px-modal__panel">
        {onClose && (
          <button className="px-modal__close" onClick={onClose} aria-label="Close" data-testid="modal-close">
            ✕
          </button>
        )}
        {children}
      </PixelPanel>
    </div>
  )
}
