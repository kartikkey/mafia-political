/** Server-clock estimation (NTP-style). A sample is one TIME_SYNC round trip. */
export interface ClockSample {
  /** Client time when the request was sent. */
  sentAt: number
  /** Server time in the reply. */
  serverNow: number
  /** Client time when the reply arrived. */
  receivedAt: number
}

/** Offset to add to the client clock to get server time; uses the lowest-latency sample. */
export function estimateClockOffset(samples: ClockSample[]): number {
  if (samples.length === 0) return 0
  const best = [...samples].sort((a, b) => a.receivedAt - a.sentAt - (b.receivedAt - b.sentAt))[0]
  return Math.round(best.serverNow - (best.sentAt + best.receivedAt) / 2)
}
