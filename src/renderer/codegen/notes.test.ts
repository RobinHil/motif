import { describe, expect, it } from 'vitest'
import { noteNameToMidi, notesPattern, noteTokenRanges } from './notes'
import { note } from './test-fixtures'

describe('noteNameToMidi', () => {
  it('reads letters, accidentals and octaves', () => {
    expect(noteNameToMidi('c3')).toBe(48)
    expect(noteNameToMidi('C4')).toBe(60)
    expect(noteNameToMidi('c#3')).toBe(49)
    expect(noteNameToMidi('cs3')).toBe(49)
    expect(noteNameToMidi('eb3')).toBe(51)
    expect(noteNameToMidi('bb1')).toBe(34)
    expect(noteNameToMidi('C-1')).toBe(0)
    expect(noteNameToMidi('a')).toBe(57)
    expect(noteNameToMidi('h3')).toBe(0)
  })
})

describe('notesPattern', () => {
  const content = (notes: ReturnType<typeof note>[]) => ({ mode: 'note' as const, stepsPerCycle: 16 as const, notes })

  it('orders chord members by pitch, then by token for equal pitches', () => {
    expect(notesPattern(content([note(0, 16, 'e3'), note(0, 16, 'fb3'), note(0, 16, 'c3')]))).toBe(
      'note("[c3,e3,fb3]")',
    )
  })

  it('keeps a voice without velocity changes plain inside a stack', () => {
    const notes = [note(0, 8, 'c3'), note(4, 8, 'e3', { velocity: 0.5 }), note(8, 8, 'g3')]
    expect(notesPattern(content(notes))).toBe('stack(note("c3 g3"), note("~ e3@2 ~").velocity("~ 0.5@2 ~"))')
  })
})

describe('noteTokenRanges', () => {
  const content = (notes: ReturnType<typeof note>[], mode: 'note' | 'degree' = 'note') => ({
    mode,
    stepsPerCycle: 16 as const,
    notes,
  })

  it('points at each note in the generated pattern', () => {
    const notes = [note(0, 2, 0), note(2, 2, 2), note(6, 2, 5, { alternatives: [7] }), note(10, 2, 4)]
    const c = content(notes, 'degree')
    const code = notesPattern(c)
    const ranges = noteTokenRanges(c)
    expect(code).toBe('n("0 2 ~ <5 7> ~ 4 ~ ~")')
    expect(notes.map((n) => code.slice(...(ranges.get(n.id) ?? [0, 0])))).toEqual(['0', '2', '<5 7>', '4'])
  })

  it('covers weights, chords, layers and velocity stacks', () => {
    const chord = [note(0, 8, 'c3'), note(0, 8, 'e3'), note(4, 12, 'g3', { velocity: 0.5 }), note(8, 8, 'b3')]
    const c = content(chord)
    const code = notesPattern(c)
    const ranges = noteTokenRanges(c)
    expect(code).toBe('stack(note("[c3,e3] b3"), note("~ g3@3").velocity("~ 0.5@3"))')
    expect(chord.map((n) => code.slice(...(ranges.get(n.id) ?? [0, 0])))).toEqual(['[c3,e3]', '[c3,e3]', 'g3@3', 'b3'])
    const layered = content([note(0, 8, 'c3'), note(4, 4, 'e3')])
    const layeredCode = notesPattern(layered)
    expect(layeredCode.slice(...(noteTokenRanges(layered).get(layered.notes[1]?.id ?? '') ?? [0, 0]))).toBe('e3')
    expect(noteTokenRanges(content([])).size).toBe(0)
  })
})
