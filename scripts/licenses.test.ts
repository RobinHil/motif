import { describe, expect, it } from 'vitest'
import { isCompatible } from './licenses'

describe('isCompatible', () => {
  it('accepts permissive and AGPL-family licenses', () => {
    expect(isCompatible('MIT')).toBe(true)
    expect(isCompatible('AGPL-3.0-or-later')).toBe(true)
    expect(isCompatible('Apache-2.0')).toBe(true)
  })

  it('rejects unknown, proprietary and GPL-2.0-only licenses', () => {
    expect(isCompatible('UNKNOWN')).toBe(false)
    expect(isCompatible('SEE LICENSE IN LICENSE.md')).toBe(false)
    expect(isCompatible('GPL-2.0-only')).toBe(false)
    expect(isCompatible('CC-BY-NC-4.0')).toBe(false)
    expect(isCompatible('')).toBe(false)
  })

  it('evaluates OR and AND expressions', () => {
    expect(isCompatible('(MIT OR GPL-2.0-only)')).toBe(true)
    expect(isCompatible('(MIT AND CC-BY-NC-4.0)')).toBe(false)
    expect(isCompatible('(MIT AND Zlib)')).toBe(true)
    expect(isCompatible('(GPL-2.0-only OR (MIT AND BSD-3-Clause))')).toBe(true)
  })

  it('reads the deprecated "+" suffix as "or later"', () => {
    expect(isCompatible('LGPL-3.0+')).toBe(true)
    expect(isCompatible('GPL-2.0+')).toBe(false)
  })
})
