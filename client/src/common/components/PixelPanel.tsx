import type { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
  className?: string
}

/** Wood-framed navy panel used across every screen (Visual Pack Board 3). */
export default function PixelPanel({ title, children, className = '' }: Props) {
  return (
    <section className={`px-panel ${className}`}>
      {title && <h2 className="px-panel__title">{title}</h2>}
      {children}
    </section>
  )
}
