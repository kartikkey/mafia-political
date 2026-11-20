import { useEffect, useState } from 'react'

/** Force a re-render on an interval — for proximity prompts driven by ref state. */
export function useRerenderEvery(ms: number) {
  const [, set] = useState(0)
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}
