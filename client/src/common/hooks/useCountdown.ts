import { useEffect, useState } from 'react'

/** Seconds remaining until a server timestamp (Spec §10.1: server owns time). */
export function useCountdown(endsAt: number | null | undefined): number {
  const calc = () => (endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0)
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    setLeft(calc())
    if (!endsAt) return
    const id = setInterval(() => setLeft(calc()), 250)
    return () => clearInterval(id)
  }, [endsAt])
  return left
}
