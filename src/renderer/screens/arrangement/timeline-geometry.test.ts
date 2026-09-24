import { describe, expect, it } from 'vitest'
import { cycleAt, rulerTicks, visibleCycles } from './timeline-geometry'

describe('timeline geometry', () => {
  it('shows the song with room to spare', () => {
    expect(visibleCycles(56)).toBe(64)
    expect(visibleCycles(60)).toBe(68)
    expect(rulerTicks(64).slice(0, 3)).toEqual([0, 4, 8])
    expect(rulerTicks(300)[1]).toBe(16)
  })

  it('maps a pointer position to a whole cycle', () => {
    expect(cycleAt(150, { left: 50, width: 640 }, 64)).toBe(10)
    expect(cycleAt(0, { left: 50, width: 640 }, 64)).toBe(0)
  })
})
