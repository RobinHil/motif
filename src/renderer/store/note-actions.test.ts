import { describe, expect, it } from 'vitest'
import { generateTrackCode } from '../codegen/generate'
import { playedEvents } from '../codegen/strudel-harness'
import { createDemoProject } from '../model/demo'
import { ProjectSchema, type Note, type Track } from '../model/project'
import { parseScale } from '../model/scales'
import * as notes from './note-actions'
import { createProjectStore } from './project-store'

const setup = () => {
  const store = createProjectStore(createDemoProject(new Date(0)))
  const apply = (recipe: Parameters<ReturnType<typeof store.getState>['update']>[0]) => store.getState().update(recipe)
  const lead = () => store.getState().project.tracks[2] as Track
  const bass = () => store.getState().project.tracks[1] as Track
  const note = (track: Track, id: string) => track.notes?.notes.find((n) => n.id === id) as Note
  return { store, apply, lead, bass, note }
}

describe('scale changes in degree mode', () => {
  it('transpose the melody without touching the notes of the model', async () => {
    const { apply, lead } = setup()
    const before = lead().notes?.notes
    apply(notes.setScale('demo-lead', 'D:dorian'))
    expect(lead().notes?.notes).toBe(before)
    const code = generateTrackCode(lead(), false)
    expect(code).toBe('$: n("0 2 4 <5 7> ~ 4 2 ~").scale("D:dorian").s("triangle").room(0.4).jux(rev).orbit(3)')
    const played = (await playedEvents(code)).filter((e) => e.value['pan'] === 0).map((e) => e.value['note'])
    expect(played).toEqual(['D3', 'F3', 'A3', 'B3', 'A3', 'F3'])
  })
})

describe('note editing', () => {
  it('moves notes in time and pitch, clamped to the cycle', () => {
    const { apply, bass, note } = setup()
    apply(notes.moveNotes('demo-bass', ['demo-bass-1', 'demo-bass-4'], 1, 2, 1))
    expect(note(bass(), 'demo-bass-1')).toMatchObject({ step: 1, pitch: 'd2' })
    expect(note(bass(), 'demo-bass-4')).toMatchObject({ step: 12, pitch: 'a1' })
    apply(notes.moveNotes('demo-bass', ['demo-bass-1'], 0, 1, 1, parseScale('C:minor')))
    expect(note(bass(), 'demo-bass-1').pitch).toBe('d#2')
  })

  it('edits one cycle at a time, creating alternatives', () => {
    const { apply, lead, note } = setup()
    apply(notes.moveNotes('demo-lead', ['demo-lead-4'], 0, 1, 2))
    expect(note(lead(), 'demo-lead-4')).toMatchObject({ pitch: 5, alternatives: [8] })
    apply(notes.setNotePitch('demo-lead', 'demo-lead-1', 3, 3))
    expect(note(lead(), 'demo-lead-1')).toMatchObject({ pitch: 0, alternatives: [0, 3] })
    apply(notes.moveNotes('demo-lead', ['demo-lead-1'], 0, -1, 'all'))
    expect(note(lead(), 'demo-lead-1')).toMatchObject({ pitch: -1, alternatives: [-1, 2] })
    expect(notes.pitchOnCycle(note(lead(), 'demo-lead-1'), 4)).toBe(-1)
    apply(notes.setNotePitch('demo-lead', 'demo-lead-2', 9, 'all'))
    expect(note(lead(), 'demo-lead-2').pitch).toBe(9)
  })

  it('resizes, deletes, pastes and sets values', () => {
    const { apply, bass, note } = setup()
    apply(notes.resizeNote('demo-bass', 'demo-bass-4', 9))
    expect(note(bass(), 'demo-bass-4').length).toBe(4)
    apply(notes.resizeNote('demo-bass', 'demo-bass-1', 0))
    expect(note(bass(), 'demo-bass-1').length).toBe(1)
    const copied = [note(bass(), 'demo-bass-1'), note(bass(), 'demo-bass-4')]
    let n = 0
    const paste = notes.pasteNotes('demo-bass', copied, 2, () => `p${String(n++)}`)
    apply(paste.recipe)
    expect(paste.ids).toEqual(['p0'])
    expect(note(bass(), 'p0')).toMatchObject({ step: 2, pitch: 'c2' })
    apply(notes.setNoteValues('demo-bass', ['p0'], { velocity: 1.4, probability: 0.555 }))
    expect(note(bass(), 'p0')).toMatchObject({ velocity: 1, probability: 0.56 })
    apply(notes.deleteNotes('demo-bass', ['p0', 'demo-bass-2']))
    expect(bass().notes?.notes.map((x) => x.id)).toEqual(['demo-bass-1', 'demo-bass-3', 'demo-bass-4'])
  })

  it('adds and removes per-cycle variants', () => {
    const { apply, lead, note } = setup()
    apply(notes.addVariant('demo-lead', 'demo-lead-4'))
    expect(note(lead(), 'demo-lead-4').alternatives).toEqual([7, 7])
    apply(notes.addVariant('demo-lead', 'demo-lead-1'))
    expect(note(lead(), 'demo-lead-1').alternatives).toEqual([0])
    apply(notes.removeVariants('demo-lead', 'demo-lead-4'))
    expect(note(lead(), 'demo-lead-4').alternatives).toBeUndefined()
  })

  it('humanizes velocities within bounds, the same way for the same seed', () => {
    const a = setup()
    const b = setup()
    const ids = ['demo-bass-1', 'demo-bass-2', 'demo-bass-3', 'demo-bass-4']
    a.apply(notes.humanize('demo-bass', ids, 7))
    b.apply(notes.humanize('demo-bass', ids, 7))
    const velocities = a.bass().notes?.notes.map((x) => x.velocity) ?? []
    expect(velocities).toEqual(b.bass().notes?.notes.map((x) => x.velocity))
    expect(new Set(velocities).size).toBeGreaterThan(1)
    expect(velocities.every((v) => v >= 0.1 && v <= 1)).toBe(true)
  })

  it('arpeggiates a chord from the lowest note', () => {
    const { apply, bass, store } = setup()
    apply((p) => {
      const content = p.tracks[1]?.notes
      if (!content) return
      content.notes = [
        { id: 'g', step: 0, length: 12, pitch: 'g3', velocity: 1, probability: 1 },
        { id: 'c', step: 0, length: 12, pitch: 'c3', velocity: 1, probability: 1 },
        { id: 'e', step: 0, length: 12, pitch: 'e3', velocity: 1, probability: 1 },
      ]
    })
    apply(notes.arpeggiate('demo-bass', ['g', 'c', 'e'], null))
    expect(bass().notes?.notes.map((x) => [x.id, x.step, x.length])).toEqual([
      ['g', 8, 4],
      ['c', 0, 4],
      ['e', 4, 4],
    ])
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })
})

describe('mode switch', () => {
  it('turns degrees into note names and back, snapping out-of-scale notes', () => {
    const { apply, lead, bass, store } = setup()
    apply(notes.setNoteMode('demo-lead', 'note'))
    expect(lead().notes).toMatchObject({ mode: 'note', scale: 'C:minor' })
    expect(lead().notes?.notes.map((n) => n.pitch)).toEqual(['c3', 'd#3', 'g3', 'g#3', 'g3', 'd#3'])
    expect(lead().notes?.notes[3]?.alternatives).toEqual(['c4'])
    apply(notes.setNoteMode('demo-lead', 'degree'))
    expect(lead().notes?.notes.map((n) => n.pitch)).toEqual([0, 2, 4, 5, 4, 2])

    apply(notes.setNoteMode('demo-bass', 'degree', 'C:major'))
    expect(bass().notes).toMatchObject({ mode: 'degree', scale: 'C:major' })
    expect(bass().notes?.notes.map((n) => n.pitch)).toEqual([-7, -7, -6, -10])
    apply(notes.setNoteMode('demo-bass', 'degree'))
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('shifts pitches and maps them to MIDI', () => {
    expect(notes.shiftPitch('b2', 1)).toBe('c3')
    expect(notes.shiftPitch(3, -5)).toBe(-2)
    expect(notes.pitchToMidi('c3', null)).toBe(48)
    expect(notes.pitchToMidi(2, parseScale('C:minor'))).toBe(51)
    expect(notes.pitchToMidi(2, null)).toBe(50)
  })
})
