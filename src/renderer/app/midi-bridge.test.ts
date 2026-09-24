import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../model/demo'
import { mergeDevices, pianoRollTrack, pitchFor } from './midi-bridge'

describe('MIDI bridge helpers', () => {
  it('keeps unplugged devices listed as disconnected', () => {
    const first = mergeDevices([], ['nanoKONTROL2'])
    expect(mergeDevices(first, [])).toEqual([{ name: 'nanoKONTROL2', connected: false }])
    expect(mergeDevices(mergeDevices(first, []), ['nanoKONTROL2', 'Keys'])).toEqual([
      { name: 'nanoKONTROL2', connected: true },
      { name: 'Keys', connected: true },
    ])
  })

  it('records into the selected notes track, with note names or scale degrees', () => {
    const { tracks } = createDemoProject(new Date(0))
    expect(pianoRollTrack(tracks, 'demo-lead')?.name).toBe('Lead')
    expect(pianoRollTrack(tracks, 'demo-drums')?.name).toBe('Bass')
    const bass = tracks.find((t) => t.name === 'Bass')
    const lead = tracks.find((t) => t.name === 'Lead')
    if (!bass || !lead) throw new Error('demo tracks')
    expect(pitchFor(bass, 61)).toBe('c#4')
    // Lead is in C minor degrees from c3 (48): 51 is eb3, degree 2.
    expect(pitchFor(lead, 51)).toBe(2)
  })
})
