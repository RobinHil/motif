import { describe, expect, it } from 'vitest'
import { nextBoundary } from './live-scenes'

describe('next scene boundary', () => {
  // 120 BPM, 4 beats per cycle: half a cycle per second.
  it('is the next cycle when there is time to evaluate', () => {
    expect(nextBoundary(20.3, 0.5)).toBe(21)
    expect(nextBoundary(20, 0.5)).toBe(21)
  })

  it('skips a boundary too close to reach in time', () => {
    expect(nextBoundary(20.85, 0.5)).toBe(22)
    expect(nextBoundary(20.3, 2)).toBe(22)
  })
})
