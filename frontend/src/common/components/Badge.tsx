import type { ReactNode } from 'react'

type Tone = 'success' | 'info' | 'neutral' | 'error' | 'warning'

/** Always pair colour with a text label — never rely on colour alone (Spec §11.4). */
export default function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`px-badge px-badge--${tone}`}>{children}</span>
}
