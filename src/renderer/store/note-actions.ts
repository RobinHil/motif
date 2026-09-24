// Piano roll edits (SPEC 6.3). Each one is a recipe for ProjectState.update, so it is undoable.
import type { Draft } from 'immer'
import { noteNameToMidi } from '../codegen/notes'
import { newId, type IdFactory } from '../model/defaults'
import { STEPS_PER_CYCLE, type ID, type Note, type NoteContent } from '../model/project'
import { degreeToMidi, midiToNoteName, nearestDegree, parseScale, snapToScale, type ParsedScale } from '../model/scales'
import type { Recipe } from './project-store'

type Pitch = Note['pitch']
/** Which cycle an edit applies to: 1 is the note's pitch, 2 its first alternative..., 'all' every cycle. */
export type EditCycle = number | 'all'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function withNotes(trackId: ID, edit: (content: Draft<NoteContent>) => void): Recipe {
  return (project) => {
    const content = project.tracks.find((t) => t.id === trackId)?.notes
    if (content) edit(content)
  }
}

export function pitchToMidi(pitch: Pitch, scale: ParsedScale | null): number {
  if (typeof pitch === 'string') return noteNameToMidi(pitch)
  return scale ? degreeToMidi(pitch, scale) : 48 + pitch
}

/** Moves a pitch by `delta` rows: semitones in note mode, degrees in degree mode. */
export function shiftPitch(pitch: Pitch, delta: number, snap: ParsedScale | null = null): Pitch {
  if (typeof pitch === 'number') return pitch + delta
  const midi = noteNameToMidi(pitch) + delta
  return midiToNoteName(snap ? snapToScale(midi, snap) : midi)
}

/** The pitch a note plays on a given cycle (cycle 1 is `pitch`, then the alternatives, looping). */
export function pitchOnCycle(note: Note, cycle: number): Pitch {
  const all = [note.pitch, ...(note.alternatives ?? [])]
  return all[(cycle - 1) % all.length] ?? note.pitch
}

/** Sets the pitch a note plays on `cycle`, creating the alternatives it needs. */
function setPitchOnCycle(note: Draft<Note>, cycle: number, pitch: Pitch) {
  if (cycle <= 1) {
    note.pitch = pitch
    return
  }
  const alternatives = note.alternatives ?? []
  while (alternatives.length < cycle - 1) alternatives.push(alternatives.at(-1) ?? note.pitch)
  alternatives[cycle - 2] = pitch
  note.alternatives = alternatives
}

export function moveNotes(
  trackId: ID,
  ids: readonly ID[],
  deltaStep: number,
  deltaPitch: number,
  cycle: EditCycle,
  snap: ParsedScale | null = null,
): Recipe {
  return withNotes(trackId, (content) => {
    for (const note of content.notes) {
      if (!ids.includes(note.id)) continue
      note.step = clamp(note.step + deltaStep, 0, STEPS_PER_CYCLE - note.length)
      if (deltaPitch === 0) continue
      if (cycle === 'all') {
        note.pitch = shiftPitch(note.pitch, deltaPitch, snap)
        if (note.alternatives) note.alternatives = note.alternatives.map((p) => shiftPitch(p, deltaPitch, snap))
      } else {
        setPitchOnCycle(note, cycle, shiftPitch(pitchOnCycle(note, cycle), deltaPitch, snap))
      }
    }
  })
}

export function setNotePitch(trackId: ID, id: ID, pitch: Pitch, cycle: EditCycle): Recipe {
  return withNotes(trackId, (content) => {
    const note = content.notes.find((n) => n.id === id)
    if (!note) return
    if (cycle === 'all') note.pitch = pitch
    else setPitchOnCycle(note, cycle, pitch)
  })
}

export function resizeNote(trackId: ID, id: ID, length: number): Recipe {
  return withNotes(trackId, (content) => {
    const note = content.notes.find((n) => n.id === id)
    if (note) note.length = clamp(Math.round(length), 1, STEPS_PER_CYCLE - note.step)
  })
}

export function deleteNotes(trackId: ID, ids: readonly ID[]): Recipe {
  return withNotes(trackId, (content) => {
    content.notes = content.notes.filter((n) => !ids.includes(n.id))
  })
}

/** Pastes copied notes `offset` steps later; notes that would leave the cycle are dropped. */
export function pasteNotes(
  trackId: ID,
  notes: readonly Note[],
  offset: number,
  newIdFn: IdFactory = newId,
): { ids: ID[]; recipe: Recipe } {
  const pasted = notes
    .map((n) => ({ ...structuredClone(n), id: newIdFn(), step: n.step + offset }))
    .filter((n) => n.step >= 0 && n.step + n.length <= STEPS_PER_CYCLE)
  return {
    ids: pasted.map((n) => n.id),
    recipe: withNotes(trackId, (content) => {
      content.notes.push(...pasted)
    }),
  }
}

export function setNoteValues(
  trackId: ID,
  ids: readonly ID[],
  values: { velocity?: number; probability?: number },
): Recipe {
  return withNotes(trackId, (content) => {
    for (const note of content.notes) {
      if (!ids.includes(note.id)) continue
      if (values.velocity !== undefined) note.velocity = clamp(Number(values.velocity.toFixed(2)), 0, 1)
      if (values.probability !== undefined) note.probability = clamp(Number(values.probability.toFixed(2)), 0, 1)
    }
  })
}

/** Adds a pitch for one more cycle; the note then alternates `<p a1 ...>`. */
export function addVariant(trackId: ID, id: ID): Recipe {
  return withNotes(trackId, (content) => {
    const note = content.notes.find((n) => n.id === id)
    if (!note) return
    note.alternatives = [...(note.alternatives ?? []), note.alternatives?.at(-1) ?? note.pitch]
  })
}

export function removeVariants(trackId: ID, id: ID): Recipe {
  return withNotes(trackId, (content) => {
    const note = content.notes.find((n) => n.id === id)
    if (note) delete note.alternatives
  })
}

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Varies velocities slightly (plus or minus 0.12) so repeated notes do not sound mechanical. Timing
 * stays on the 16-step grid, which the model cannot offset.
 */
export function humanize(trackId: ID, ids: readonly ID[], seed = 1): Recipe {
  return withNotes(trackId, (content) => {
    const random = seeded(seed)
    for (const note of content.notes) {
      if (!ids.includes(note.id)) continue
      note.velocity = clamp(Number((note.velocity + (random() - 0.5) * 0.24).toFixed(2)), 0.1, 1)
    }
  })
}

/** Spreads each selected chord over its length, lowest note first. */
export function arpeggiate(trackId: ID, ids: readonly ID[], scale: ParsedScale | null): Recipe {
  return withNotes(trackId, (content) => {
    const chosen = content.notes.filter((n) => ids.includes(n.id))
    const byStep = new Map<number, Draft<Note>[]>()
    for (const note of chosen) byStep.set(note.step, [...(byStep.get(note.step) ?? []), note])
    for (const [step, chord] of byStep) {
      if (chord.length < 2) continue
      chord.sort((a, b) => pitchToMidi(a.pitch, scale) - pitchToMidi(b.pitch, scale))
      const span = Math.max(...chord.map((n) => n.length))
      const length = Math.max(1, Math.floor(span / chord.length))
      chord.forEach((note, i) => {
        note.step = Math.min(STEPS_PER_CYCLE - 1, step + i * length)
        note.length = clamp(length, 1, STEPS_PER_CYCLE - note.step)
      })
    }
  })
}

export function setScale(trackId: ID, scale: string): Recipe {
  return withNotes(trackId, (content) => {
    content.scale = scale
  })
}

/**
 * Switches between note names and scale degrees. Degrees become exact note names; notes become the
 * nearest degree of the scale, so out-of-scale notes snap.
 */
export function setNoteMode(trackId: ID, mode: NoteContent['mode'], fallbackScale = 'C:minor'): Recipe {
  return withNotes(trackId, (content) => {
    if (content.mode === mode) return
    const scaleName = content.scale ?? fallbackScale
    const scale = parseScale(scaleName)
    if (!scale) return
    const convert = (pitch: Pitch): Pitch =>
      mode === 'degree'
        ? nearestDegree(typeof pitch === 'string' ? noteNameToMidi(pitch) : pitch, scale)
        : midiToNoteName(typeof pitch === 'number' ? degreeToMidi(pitch, scale) : noteNameToMidi(pitch))
    for (const note of content.notes) {
      note.pitch = convert(note.pitch)
      if (note.alternatives) note.alternatives = note.alternatives.map(convert)
    }
    content.mode = mode
    content.scale = scaleName
  })
}
