import { describe, expect, it } from 'vitest'
import { paramsCode } from '../../codegen/params'
import type { Modulation } from '../../model/project'
import {
  animatable,
  animatedParams,
  bounds,
  defaultModulation,
  SHAPES,
  shapeOf,
  withBounds,
  withShape,
  withUnit,
} from './modulation-targets'

const lpf = animatable('lpf')
if (!lpf) throw new Error('lpf is animatable')

describe('modulation targets', () => {
  it('starts with the classic filter sine', () => {
    const mod = defaultModulation(lpf)
    expect(paramsCode({ gain: 1, pan: 0.5, lpf: mod })).toBe('.lpf(sine.range(300, 1200).slow(4))')
    expect(lpf.title).toBe('Low-pass filter')
    expect(withUnit(300, lpf.unit)).toBe('300 Hz')
  })

  it.each(SHAPES.map((s) => [s.id, s.code] as const))('writes the %s shape as %s', (id, code) => {
    const mod = withShape(defaultModulation(lpf), id, lpf)
    const written = paramsCode({ gain: 1, pan: 0.5, lpf: mod })
    if (id === 'sequence') expect(written).toBe('.lpf("<300 689 1200 455>")')
    else expect(written).toBe(`.lpf(${code}.range(300, 1200).slow(4))`)
    expect(shapeOf(mod)).toBe(id)
  })

  it('keeps bounds and cycle length when the shape changes', () => {
    const sequence: Modulation = { kind: 'sequence', values: [200, 800, 1200, 400] }
    expect(withShape(sequence, 'square', lpf)).toEqual({
      kind: 'signal',
      shape: 'square',
      min: 200,
      max: 1200,
      cycles: 4,
    })
    expect(withShape(sequence, 'sequence', lpf)).toBe(sequence)
    const slow: Modulation = { kind: 'signal', shape: 'saw', min: 1, max: 2, cycles: 16 }
    expect(withShape(slow, 'perlin', lpf)).toMatchObject({ shape: 'perlin', cycles: 16 })
    expect(bounds(sequence)).toEqual([200, 1200])
  })

  it('moves the bounds of a signal, or rescales a sequence', () => {
    expect(withBounds(defaultModulation(lpf), 500, 2000)).toMatchObject({ min: 500, max: 2000 })
    expect(withBounds({ kind: 'sequence', values: [0, 5, 10] }, 10, 20)).toEqual({
      kind: 'sequence',
      values: [10, 15, 20],
    })
  })

  it('lists animated parameters across tracks', () => {
    const tracks = [
      { id: 'a', name: 'Bass', params: { gain: 1, lpf: defaultModulation(lpf) } },
      {
        id: 'b',
        name: 'Texture',
        params: { speed: { kind: 'signal', shape: 'perlin', min: 0.5, max: 1.5, cycles: 1 } as Modulation },
      },
    ]
    expect(animatedParams(tracks)).toEqual([
      { trackId: 'a', trackName: 'Bass', key: 'lpf', label: 'Filter', code: 'sine' },
      { trackId: 'b', trackName: 'Texture', key: 'speed', label: 'Speed', code: 'perlin' },
    ])
  })
})
