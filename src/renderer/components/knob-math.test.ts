import { describe, expect, it } from 'vitest'
import { arcPath, fromNormalized, parseTyped, roundToStep, toNormalized, type KnobRange } from './knob-math'

const gain: KnobRange = { min: 0, max: 1.5, scale: 'linear', step: 0.01 }
const cutoff: KnobRange = { min: 50, max: 20000, scale: 'log', step: 1 }

describe('knob math', () => {
  it('maps linear values both ways and rounds to the step', () => {
    expect(toNormalized(0.75, gain)).toBe(0.5)
    expect(fromNormalized(0.5, gain)).toBe(0.75)
    expect(fromNormalized(0.3333, gain)).toBe(0.5)
    expect(fromNormalized(2, gain)).toBe(1.5)
    expect(toNormalized(-3, gain)).toBe(0)
  })

  it('maps log values so octaves take the same distance', () => {
    expect(fromNormalized(0, cutoff)).toBe(50)
    expect(fromNormalized(1, cutoff)).toBe(20000)
    const a = toNormalized(400, cutoff) - toNormalized(200, cutoff)
    const b = toNormalized(1600, cutoff) - toNormalized(800, cutoff)
    expect(a).toBeCloseTo(b)
    expect(fromNormalized(toNormalized(1000, cutoff), cutoff)).toBe(1000)
  })

  it('rounds to steps without float noise', () => {
    expect(roundToStep(0.1 + 0.2, 0.01)).toBe(0.3)
    expect(roundToStep(123.456, 1)).toBe(123)
  })

  it('draws a 270 degree arc open at the bottom', () => {
    expect(arcPath(24, 24, 20, 0, 0)).toBe('')
    const full = arcPath(24, 24, 20, 0, 1)
    expect(full.startsWith('M 9.86 38.14')).toBe(true)
    expect(full).toContain(' 0 1 1 38.14 38.14')
    expect(arcPath(24, 24, 20, 0, 0.25)).toContain(' 0 0 1 ')
  })

  it('parses typed values, clamped, with a comma allowed', () => {
    expect(parseTyped('0,5', gain)).toBe(0.5)
    expect(parseTyped('9', gain)).toBe(1.5)
    expect(parseTyped('abc', gain)).toBeNull()
    expect(parseTyped('  ', gain)).toBeNull()
  })
})
