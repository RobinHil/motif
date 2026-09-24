import { describe, expect, it } from 'vitest'
import { noteNameToMidi } from '../codegen/notes'
import { playedEvents } from '../codegen/strudel-harness'
import {
  degreeToMidi,
  displayNoteName,
  inScale,
  midiToNoteName,
  nearestDegree,
  parseScale,
  ROOTS,
  SCALE_TYPES,
  snapToScale,
} from './scales'

describe('scales', () => {
  it.each(SCALE_TYPES.map((t) => [t.name] as const))('matches Strudel for %s', async (type) => {
    const degrees = [-8, -3, -1, 0, 1, 2, 4, 6, 7, 9, 13]
    for (const root of ['C', 'F#', 'Bb', 'E4']) {
      const scale = `${root}:${type}`
      const parsed = parseScale(scale)
      expect(parsed, scale).not.toBeNull()
      if (!parsed) continue
      const events = await playedEvents(`n("${degrees.join(' ')}").scale("${scale}")`)
      const strudel = events.map((e) => noteNameToMidi(String(e.value['note'])))
      expect(
        degrees.map((d) => degreeToMidi(d, parsed)),
        scale,
      ).toEqual(strudel)
    }
  })

  it('parses roots, octaves and multi-word types, and refuses unknown scales', () => {
    expect(parseScale('C:minor')).toEqual({ root: 48, intervals: [0, 2, 3, 5, 7, 8, 10] })
    expect(parseScale('Eb4:harmonic:minor')?.root).toBe(63)
    expect(parseScale('C:ritusen')).toBeNull()
    expect(parseScale('minor')).toBeNull()
    expect(ROOTS).toHaveLength(12)
  })

  it('finds scale membership, nearest degrees and snapped pitches', () => {
    const cMinor = parseScale('C:minor')
    if (!cMinor) throw new Error('scale')
    expect(inScale(51, cMinor)).toBe(true) // Eb3
    expect(inScale(52, cMinor)).toBe(false) // E3
    expect(nearestDegree(56, cMinor)).toBe(5) // Ab3
    expect(nearestDegree(60, cMinor)).toBe(7) // C4
    expect(nearestDegree(52, cMinor)).toBe(2) // E3 -> Eb3 (tie goes down)
    expect(nearestDegree(40, cMinor)).toBe(-5)
    expect(snapToScale(52, cMinor)).toBe(51)
  })

  it('names notes for the code and for the interface', () => {
    expect(midiToNoteName(61)).toBe('c#4')
    expect(midiToNoteName(48)).toBe('c3')
    expect(midiToNoteName(11)).toBe('b-1')
    expect(displayNoteName('eb3')).toBe('Eb3')
    expect(displayNoteName('c#4')).toBe('C#4')
  })
})
