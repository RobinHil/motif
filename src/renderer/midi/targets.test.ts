import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../model/demo'
import { createProjectStore } from '../store/project-store'
import { quantizeNote } from './quantize'
import { ccValue, learnMapping, mappingsFor, removeMapping, targetSpec, TEMPO_TARGET } from './targets'

const mapping = (cc: number, trackId: string, param: string) => ({
  deviceName: 'nanoKONTROL2',
  channel: 1,
  cc,
  target: { trackId, param },
})

describe('MIDI targets', () => {
  it('turns CC values into parameter values on the knob scale', () => {
    const project = createDemoProject(new Date(0))
    const volume = targetSpec(project, { trackId: 'demo-drums', param: 'gain' })
    expect(volume?.label).toBe('Drums volume')
    expect(ccValue(0, volume!.range)).toBe(0) // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(ccValue(127, volume!.range)).toBe(1.5) // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    const filter = targetSpec(project, { trackId: 'demo-lead', param: 'lpf' })
    expect(ccValue(64, filter!.range)).toBe(1020) // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(targetSpec(project, { trackId: 'gone', param: 'gain' })).toBeNull()
  })

  it('drives tracks, the master and the tempo, and leaves animated parameters alone', () => {
    const store = createProjectStore(createDemoProject(new Date(0)))
    const apply = (trackId: string, param: string, cc: number) => {
      const spec = targetSpec(store.getState().project, { trackId, param })
      const recipe = spec?.apply(ccValue(cc, spec.range))
      if (recipe) store.getState().update(recipe)
      return recipe
    }
    apply('demo-drums', 'gain', 127)
    apply('master', 'width', 0)
    apply(TEMPO_TARGET.trackId, TEMPO_TARGET.param, 127)
    expect(apply('demo-bass', 'lpf', 10)).toBeNull()
    const { project } = store.getState()
    expect(project.tracks[0]?.params.gain).toBe(1.5)
    expect(project.master.width).toBe(0)
    expect(project.transport.bpm).toBe(240)
  })

  it('keeps one control per target and one target per control', () => {
    const store = createProjectStore(createDemoProject(new Date(0)))
    const { update } = store.getState()
    update(learnMapping(mapping(21, 'demo-drums', 'gain')))
    update(learnMapping(mapping(22, 'demo-drums', 'gain')))
    update(learnMapping(mapping(22, 'demo-bass', 'gain')))
    update(learnMapping(mapping(7, 'master', 'gain')))
    const mappings = store.getState().project.midiMappings
    expect(mappings.map((m) => [m.cc, m.target.trackId])).toEqual([
      [22, 'demo-bass'],
      [7, 'master'],
    ])
    expect(mappingsFor(mappings, 'nanoKONTROL2', 1, 7)).toHaveLength(1)
    expect(mappingsFor(mappings, 'Other', 1, 7)).toHaveLength(0)
    update(removeMapping({ trackId: 'master', param: 'gain' }))
    expect(store.getState().project.midiMappings).toHaveLength(1)
  })
})

describe('quantized recording', () => {
  it('rounds start and length to the grid', () => {
    expect(quantizeNote(3.26, 3.4, 1)).toEqual({ step: 4, length: 2 })
    expect(quantizeNote(3.26, 3.27, 2)).toEqual({ step: 4, length: 2 })
    expect(quantizeNote(3.98, 4.1, 1)).toEqual({ step: 0, length: 2 })
    expect(quantizeNote(3.9, 5, 1)).toEqual({ step: 14, length: 2 })
  })
})
