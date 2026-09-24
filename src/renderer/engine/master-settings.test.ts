import { describe, expect, it } from 'vitest'
import { COMPRESSOR, dynamicsFor, NEUTRAL_DYNAMICS, widthGains } from './master-settings'

describe('master settings', () => {
  it('keeps the stereo image at width 1, sums to mono at 0, widens at 2', () => {
    expect(widthGains(1)).toEqual({ same: 1, cross: 0 })
    expect(widthGains(0)).toEqual({ same: 0.5, cross: 0.5 })
    expect(widthGains(2)).toEqual({ same: 1.5, cross: -0.5 })
    expect(widthGains(5)).toEqual(widthGains(2))
    // A centered (mono) signal is never changed by width.
    for (const w of [0, 0.5, 1, 2]) {
      const { same, cross } = widthGains(w)
      expect(same + cross).toBeCloseTo(1)
    }
  })

  it('uses a neutral compressor when switched off', () => {
    expect(dynamicsFor(false, COMPRESSOR)).toBe(NEUTRAL_DYNAMICS)
    expect(dynamicsFor(true, COMPRESSOR)).toBe(COMPRESSOR)
    expect(NEUTRAL_DYNAMICS.ratio).toBe(1)
  })
})
