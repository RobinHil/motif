import { describe, expect, it } from 'vitest'
import { applyFix, editDistance, suggestFix, unknownName } from './suggest'

describe('editDistance', () => {
  it('counts swapped neighbors as one edit', () => {
    expect(editDistance('lfp', 'lpf')).toBe(1)
    expect(editDistance('gian', 'gain')).toBe(1)
    expect(editDistance('fast', 'fast')).toBe(0)
    expect(editDistance('room', 'rom')).toBe(1)
    expect(editDistance('', 'abc')).toBe(3)
  })
})

describe('suggestFix', () => {
  it('reads Strudel error messages', () => {
    expect(unknownName('note(...).lfp is not a function')).toBe('lfp')
    expect(unknownName('lfp is not defined')).toBe('lfp')
    expect(unknownName('Unexpected token')).toBeNull()
  })

  it('suggests lpf for lfp, with its short description', () => {
    expect(suggestFix('note(...).lfp is not a function')).toEqual({
      wrong: 'lfp',
      right: 'lpf',
      message: 'Unknown function lfp. Did you mean lpf (low-pass filter)?',
    })
    expect(suggestFix('s(...).dealy is not a function')?.right).toBe('delay')
    expect(suggestFix('jux2 is not defined', ['jux'])?.right).toBe('jux')
  })

  it('suggests nothing when no function is close', () => {
    expect(suggestFix('s(...).banana is not a function')).toBeNull()
    expect(suggestFix('Unexpected token (1:3)')).toBeNull()
  })
})

describe('applyFix', () => {
  const fix = { wrong: 'lfp', right: 'lpf', message: '' }

  it('replaces whole words inside the given lines only', () => {
    const code = ['setcpm(120/4)', '', '$: note("c3").lfp(300).orbit(1)', '$: s("lfp").lfp(100).orbit(2)'].join('\n')
    expect(applyFix(code, fix, 3, 3).split('\n')).toEqual([
      'setcpm(120/4)',
      '',
      '$: note("c3").lpf(300).orbit(1)',
      '$: s("lfp").lfp(100).orbit(2)',
    ])
  })

  it('does not touch longer names', () => {
    expect(applyFix('x.lfpx(1).lfp(2)', fix, 1, 1)).toBe('x.lfpx(1).lpf(2)')
  })
})
