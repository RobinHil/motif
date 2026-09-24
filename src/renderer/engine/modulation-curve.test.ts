import { describe, expect, it } from 'vitest'
import { paramValueCode } from '../codegen/params'
import { playedEvents } from '../codegen/strudel-harness'
import { SIGNAL_SHAPES, type Modulation } from '../model/project'
import { modulationAt, modulationCurve } from './modulation-curve'

const signal = (shape: (typeof SIGNAL_SHAPES)[number]): Modulation => ({
  kind: 'signal',
  shape,
  min: 300,
  max: 1200,
  cycles: 4,
})

describe('modulation curve', () => {
  it('follows the Strudel shapes over their cycle length', () => {
    expect(modulationAt(signal('sine'), 0)).toBeCloseTo(750)
    expect(modulationAt(signal('sine'), 1)).toBeCloseTo(1200)
    expect(modulationAt(signal('sine'), 3)).toBeCloseTo(300)
    expect(modulationAt(signal('saw'), 2)).toBeCloseTo(750)
    expect(modulationAt(signal('isaw'), 0)).toBeCloseTo(1200)
    expect(modulationAt(signal('tri'), 2)).toBeCloseTo(1200)
    expect(modulationAt(signal('square'), 1.9)).toBe(300)
    expect(modulationAt(signal('square'), 2.1)).toBe(1200)
  })

  it('keeps noise shapes in range and repeatable', () => {
    for (const shape of ['perlin', 'rand'] as const) {
      const curve = modulationCurve(signal(shape), 4, 50)
      expect(Math.min(...curve)).toBeGreaterThanOrEqual(300)
      expect(Math.max(...curve)).toBeLessThanOrEqual(1200)
      expect(modulationCurve(signal(shape), 4, 50)).toEqual(curve)
    }
  })

  it('holds one sequence value per cycle', () => {
    const mod: Modulation = { kind: 'sequence', values: [200, 800, 1200] }
    expect([0, 0.9, 1, 2.5, 3, -1].map((c) => modulationAt(mod, c))).toEqual([200, 200, 800, 1200, 200, 1200])
  })

  it.each([...SIGNAL_SHAPES])('matches what Strudel plays for %s', async (shape) => {
    const mod = signal(shape)
    const events = await playedEvents(`$: note("c3*8").lpf(${paramValueCode(mod)})`, 0, 4)
    expect(events).toHaveLength(32)
    for (const event of events) expect(event.value['cutoff']).toBeCloseTo(modulationAt(mod, event.begin), 6)
  })

  it('matches what Strudel plays for a sequence', async () => {
    const mod: Modulation = { kind: 'sequence', values: [200, 800, 1200] }
    const events = await playedEvents(`$: note("c3*4").lpf(${paramValueCode(mod)})`, 0, 6)
    for (const event of events) expect(event.value['cutoff']).toBe(modulationAt(mod, event.begin))
  })
})
