import type { Note, NoteContent } from '../../model/project'
import { degreeToMidi, nearestDegree, parseScale, type ParsedScale } from '../../model/scales'
import { pitchOnCycle, pitchToMidi } from '../../store/note-actions'
import type { EditCycle } from '../../store/note-actions'

/** Rows of the roll, top to bottom: B5 down to C2 (4 octaves, 2 visible at a time). */
export const HIGHEST = 95
export const LOWEST = 24
export const ROW_HEIGHT = 21
export const ROWS = HIGHEST - LOWEST + 1

export const rowOf = (midi: number) => HIGHEST - midi
export const midiOfRow = (row: number) => HIGHEST - row

export function contentScale(content: NoteContent): ParsedScale | null {
  return content.scale ? parseScale(content.scale) : null
}

/** MIDI pitch of a note on the edited cycle (cycle 1 in "All"). */
export function noteMidi(note: Note, cycle: EditCycle, scale: ParsedScale | null): number {
  return pitchToMidi(pitchOnCycle(note, cycle === 'all' ? 1 : cycle), scale)
}

/** Pitches the note plays on the other cycles, drawn dashed. */
export function ghostMidis(note: Note, cycle: EditCycle, scale: ParsedScale | null): number[] {
  const all = [note.pitch, ...(note.alternatives ?? [])].map((p) => pitchToMidi(p, scale))
  const current = noteMidi(note, cycle, scale)
  return [...new Set(all)].filter((m) => m !== current)
}

/** How many cycle tabs to show: one per cycle the notes differ on, and at least two. */
export function cycleCount(content: NoteContent): number {
  const longest = Math.max(0, ...content.notes.map((n) => n.alternatives?.length ?? 0))
  return Math.min(8, Math.max(2, longest + 1))
}

/** The pitch stored for a row: a note name, or in degree mode the nearest degree of the scale. */
export function pitchForRow(midi: number, content: NoteContent, scale: ParsedScale | null): Note['pitch'] {
  if (content.mode === 'degree' && scale) return nearestDegree(midi, scale)
  return midiToName(midi)
}

const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
function midiToName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12] ?? 'c'}${String(Math.floor(midi / 12) - 1)}`
}

/** How many rows the pitch moves when dragging from one row to another. */
export function pitchDelta(fromMidi: number, toMidi: number, content: NoteContent, scale: ParsedScale | null): number {
  if (content.mode === 'degree' && scale) return nearestDegree(toMidi, scale) - nearestDegree(fromMidi, scale)
  return toMidi - fromMidi
}

/** A length in steps written as a fraction of a whole cycle: 2 -> 1/8. */
export function lengthLabel(steps: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const d = gcd(steps, 16)
  return `${String(steps / d)}/${String(16 / d)}`
}

export { degreeToMidi }
