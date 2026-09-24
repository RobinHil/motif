import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../../model/demo'
import type { NoteContent } from '../../model/project'
import {
  contentScale,
  cycleCount,
  ghostMidis,
  lengthLabel,
  noteMidi,
  pitchDelta,
  pitchForRow,
  rowOf,
} from './roll-geometry'

const lead = () => createDemoProject().tracks[2]?.notes as NoteContent

describe('piano roll geometry', () => {
  it('places degree notes on their pitch for the edited cycle, with the other cycles as ghosts', () => {
    const content = lead()
    const scale = contentScale(content)
    const alternating = content.notes[3]
    if (!alternating) throw new Error('demo')
    expect(noteMidi(alternating, 1, scale)).toBe(56) // G#3, degree 5
    expect(noteMidi(alternating, 2, scale)).toBe(60) // C4, degree 7
    expect(ghostMidis(alternating, 1, scale)).toEqual([60])
    expect(ghostMidis(alternating, 'all', scale)).toEqual([60])
    expect(cycleCount(content)).toBe(2)
    expect(rowOf(95)).toBe(0)
  })

  it('turns rows into pitches and drags into pitch moves', () => {
    const content = lead()
    const scale = contentScale(content)
    expect(pitchForRow(52, content, scale)).toBe(2) // E3 snaps to Eb3, degree 2
    expect(pitchForRow(61, { ...content, mode: 'note' }, null)).toBe('c#4')
    expect(pitchDelta(48, 55, content, scale)).toBe(4)
    expect(pitchDelta(48, 55, { ...content, mode: 'note' }, null)).toBe(7)
  })

  it('writes lengths as fractions of a cycle', () => {
    expect([1, 2, 4, 6, 16].map(lengthLabel)).toEqual(['1/16', '1/8', '1/4', '3/8', '1/1'])
  })
})
