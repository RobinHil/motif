import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../../model/demo'
import type { Track } from '../../model/project'
import { addableEffects, effectRows } from './mixer-effects'

const demo = () => createDemoProject(new Date(0)).tracks

describe('effectRows', () => {
  it('lists effect parameters, then transforms, with their values', () => {
    const [, bass, lead] = demo()
    expect(effectRows(bass as Track)).toEqual([
      { kind: 'param', key: 'lpf', label: 'Filter', value: 'sine', modulated: true, bypassed: false },
    ])
    expect(effectRows(lead as Track)).toEqual([
      { kind: 'transform', id: 'demo-lead-jux', type: 'jux', label: 'Stereo', value: 'jux(rev)', bypassed: false },
    ])
  })

  it('marks bypassed parameters and disabled transforms, and names custom transforms', () => {
    const track: Track = {
      ...(demo()[0] as Track),
      params: { gain: 1, pan: 0.5, shape: 0.2, crush: 6, room: 0.3 },
      bypassed: ['crush'],
      transforms: [
        { id: 'c', type: 'chop', args: { parts: 8 }, enabled: false },
        { id: 'x', type: 'custom', args: { code: '.hurry(2)' }, enabled: true },
        { id: 'r', type: 'rev', args: {}, enabled: true },
      ],
    }
    expect(effectRows(track).map((r) => [r.label, r.value, r.bypassed])).toEqual([
      ['Saturation', '0.2', false],
      ['Bitcrush', '6', true],
      ['Chop', 'chop(8)', true],
      ['Custom', 'hurry(2)', false],
      ['Play in reverse', 'rev()', false],
    ])
  })

  it('offers only effects the track does not have yet', () => {
    const lead = demo()[2] as Track
    const labels = addableEffects(lead).map((e) => (e.kind === 'param' ? e.effect.label : e.label))
    expect(labels).toContain('Filter')
    expect(labels).toContain('Chop')
    expect(labels).not.toContain('Stereo')
  })
})
