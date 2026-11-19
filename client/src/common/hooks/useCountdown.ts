import { useEffect, useState } from 'react'
import { secondsUntil } from 'helpers/clock'

/** Seconds remaining until a server timestamp (Spec §10.1: server owns time). */
export function useCountdown(endsAt: number | null | undefined): number {
  const calc = () => secondsUntil(endsAt)
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    setLeft(calc())
    if (!endsAt) return
    const id = setInterval(() => setLeft(calc()), 250)
    return () => clearInterval(id)
  }, [endsAt])
  return left
}
