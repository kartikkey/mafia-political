/** Server-synchronised time for every countdown (cooldowns, phases, sabotage). */
let offset = 0

export const setClockOffset = (ms: number) => {
  offset = ms
}
export const clockOffset = () => offset
/** Current server time estimate. Compare server timestamps against this, never Date.now(). */
export const serverNow = () => Date.now() + offset
/** Whole seconds left until a server timestamp (0 when passed). */
export const secondsUntil = (at: number | null | undefined) => (at ? Math.max(0, Math.ceil((at - serverNow()) / 1000)) : 0)
