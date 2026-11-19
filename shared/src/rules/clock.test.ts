import { describe, expect, it } from 'vitest'
import { estimateClockOffset } from './clock'

describe('estimateClockOffset', () => {
  it('returns 0 with no samples', () => expect(estimateClockOffset([])).toBe(0))
  it('corrects a client clock that runs 90s fast, using the fastest round trip', () => {
    const skew = -90_000
    const samples = [
      { sentAt: 1000, serverNow: 1000 + skew + 400, receivedAt: 1800 }, // slow, asymmetric
      { sentAt: 2000, serverNow: 2000 + skew + 20, receivedAt: 2040 },
    ]
    expect(estimateClockOffset(samples)).toBe(skew)
  })
})
