import { describe, expect, it } from 'vitest'
import { generateTrackCode } from '../codegen/generate'
import { createDemoProject } from '../model/demo'
import { waveformPeaks } from '../viz/waveform'
import { createProjectStore } from './project-store'
import { setLoopAt, setRegion, setSlicing, suggestedCycles } from './sample-actions'

function setup() {
  const store = createProjectStore(createDemoProject())
  const track = store.getState().project.tracks.find((t) => t.kind === 'notes')
  if (!track) throw new Error('demo has a notes track')
  const code = () => {
    const t = store.getState().project.tracks.find((x) => x.id === track.id)
    if (!t) throw new Error('track')
    return generateTrackCode(t, false)
  }
  let n = 0
  return { store, id: track.id, code, ids: () => `x${String(n++)}` }
}

describe('sample editor actions', () => {
  it('writes begin and end, and leaves defaults out', () => {
    const { store, id, code } = setup()
    store.getState().update(setRegion(id, 0.25, 0.75))
    expect(code()).toContain('.begin(0.25).end(0.75)')
    store.getState().update(setRegion(id, 0, 1))
    expect(code()).not.toMatch(/\.begin|\.end/)
    store.getState().update(setRegion(id, 0.5, 0.2))
    expect(store.getState().project.tracks.find((t) => t.id === id)?.params).toMatchObject({ begin: 0.5, end: 0.501 })
  })

  it('keeps a single slicing transform and switches between slice, splice and chop', () => {
    const { store, id, code, ids } = setup()
    store.getState().update(setSlicing(id, 'slice', 4, ids))
    expect(code()).toContain('.slice(4, "0 1 2 3")')
    store.getState().update((p) => {
      const t = p.tracks.find((x) => x.id === id)?.transforms[0]
      if (t) t.args['pattern'] = '3 2 1 0'
    })
    store.getState().update(setSlicing(id, 'splice', 4, ids))
    expect(code()).toContain('.splice(4, "3 2 1 0")')
    store.getState().update(setSlicing(id, 'splice', 8, ids))
    expect(code()).toContain('.splice(8, "0 1 2 3 4 5 6 7")')
    store.getState().update(setSlicing(id, 'chop', 8, ids))
    expect(code()).toContain('.chop(8)')
    expect(code()).not.toContain('splice')
    store.getState().update(setSlicing(id, null, 8, ids))
    expect(code()).not.toContain('.chop')
  })

  it('fits the sample to a number of cycles', () => {
    const { store, id, code, ids } = setup()
    store.getState().update(setLoopAt(id, 2, ids))
    store.getState().update(setLoopAt(id, 4, ids))
    expect(code()).toContain('.loopAt(4)')
    expect(code().match(/loopAt/g)).toHaveLength(1)
    store.getState().update(setLoopAt(id, null, ids))
    expect(code()).not.toContain('loopAt')
    // 120 BPM, 4 beats: a cycle lasts 2 s.
    expect(suggestedCycles(4.1, 120, 4)).toBe(2)
    expect(suggestedCycles(0.3, 120, 4)).toBe(1)
    expect(suggestedCycles(100, 120, 4)).toBe(16)
  })

  it('reduces a channel to min and max per bucket', () => {
    expect(waveformPeaks(new Float32Array([0, 0.5, -0.25, 1, -1, 0.125]), 3)).toEqual([
      [0, 0.5],
      [-0.25, 1],
      [-1, 0.125],
    ])
  })
})
