import { describe, expect, it } from 'vitest'
import { TRANSFORM_DEFAULT_ARGS } from '../model/defaults'
import { TRANSFORM_TYPES } from '../model/project'
import { TRANSFORMS, transformsCode } from './transforms'

describe('transform labels', () => {
  it('match the SPEC table with default arguments', () => {
    const labels = Object.fromEntries(TRANSFORM_TYPES.map((t) => [t, TRANSFORMS[t].label(TRANSFORM_DEFAULT_ARGS[t])]))
    expect(labels).toEqual({
      fast: 'Speed up x2',
      slow: 'Slow down x2',
      rev: 'Play in reverse',
      jux: 'Widen stereo',
      ply: 'Double every note',
      degradeBy: 'Drop 30% at random',
      sometimes: 'Sometimes higher',
      lastOf: 'Faster every 4th cycle',
      chop: 'Chop into 8',
      striate: 'Interleave',
      slice: 'Replay slices',
      splice: 'Replay slices at tempo',
      loopAt: 'Fit to 2 cycles',
      custom: 'Custom transform',
    })
  })

  it('follow edited arguments', () => {
    expect(TRANSFORMS.fast.label({ factor: 4 })).toBe('Speed up x4')
    expect(TRANSFORMS.slow.label({ factor: 1.5 })).toBe('Slow down x1.5')
    expect(TRANSFORMS.ply.label({ factor: 3 })).toBe('Repeat every note x3')
    expect(TRANSFORMS.degradeBy.label({ amount: 0.125 })).toBe('Drop 12.5% at random')
    expect(TRANSFORMS.lastOf.label({ every: 8, factor: 2 })).toBe('Faster every 8th cycle')
    expect(TRANSFORMS.chop.label({ parts: 16 })).toBe('Chop into 16')
    expect(TRANSFORMS.loopAt.label({ cycles: 4 })).toBe('Fit to 4 cycles')
  })
})

describe('transform code', () => {
  it('uses edited arguments', () => {
    expect(TRANSFORMS.slice.code({ parts: 4, pattern: '<0 3> 1' })).toBe('.slice(4, "<0 3> 1")')
    expect(TRANSFORMS.sometimes.code({ speed: 0.5 })).toBe('.sometimes(x => x.speed(0.5))')
    expect(TRANSFORMS.lastOf.code({ every: 3, factor: 4 })).toBe('.lastOf(3, x => x.fast(4))')
    expect(TRANSFORMS.striate.code({ parts: 2 })).toBe('.striate(2)')
    expect(TRANSFORMS.splice.code({ parts: 4, pattern: '0 1 2 3' })).toBe('.splice(4, "0 1 2 3")')
  })

  it('falls back to the default when an argument has the wrong type or is missing', () => {
    expect(TRANSFORMS.chop.code({ parts: 'many' })).toBe('.chop(8)')
    expect(TRANSFORMS.slice.code({ parts: 4, pattern: 3 })).toBe('.slice(4, "0 2 1 3")')
    expect(TRANSFORMS.fast.code({ factor: Number.POSITIVE_INFINITY })).toBe('.fast(2)')
    expect(TRANSFORMS.ply.code({})).toBe('.ply(2)')
    expect(TRANSFORMS.custom.code({})).toBe('')
    expect(TRANSFORMS.rev.code({ unused: 1 })).toBe('.rev()')
  })

  it('escapes the slice pattern as a string literal', () => {
    expect(TRANSFORMS.slice.code({ parts: 2, pattern: '0"); evil("' })).toBe('.slice(2, "0\\"); evil(\\"")')
  })

  it('joins enabled transforms in order', () => {
    expect(
      transformsCode([
        { id: 'a', type: 'rev', args: {}, enabled: true },
        { id: 'b', type: 'jux', args: {}, enabled: true },
      ]),
    ).toBe('.rev().jux(rev)')
    expect(transformsCode([])).toBe('')
  })
})
