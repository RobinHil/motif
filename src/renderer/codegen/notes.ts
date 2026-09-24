import { NOTE_NAME, STEPS_PER_CYCLE, type Note, type NoteContent } from '../model/project'
import { formatNumber, gcd, safeToken } from './format'

type Pitch = Note['pitch']

const PITCH_CLASSES: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

/** MIDI number of a note name, used only to order chord members from low to high. */
export function noteNameToMidi(name: string): number {
  const match = /^([a-gA-G])((?:#|b|s)*)(-?\d{1,2})?$/.exec(name)
  if (!match) return 0
  const [, letter = 'c', accidentals = '', octave = '3'] = match
  let pitchClass = PITCH_CLASSES[letter.toLowerCase()] ?? 0
  for (const accidental of accidentals) pitchClass += accidental === 'b' ? -1 : 1
  return (Number(octave) + 1) * 12 + pitchClass
}

function pitchValue(pitch: Pitch): number {
  return typeof pitch === 'number' ? pitch : noteNameToMidi(pitch)
}

function pitchToken(pitch: Pitch): string {
  return typeof pitch === 'number' ? String(pitch) : safeToken(pitch, NOTE_NAME, 'note name')
}

/** `c3`, or `<c3 d3>` when the note varies per cycle (SPEC 4, "Note tracks"). */
function noteToken(note: Note): string {
  if (!note.alternatives?.length) return pitchToken(note.pitch)
  return `<${[note.pitch, ...note.alternatives].map(pitchToken).join(' ')}>`
}

/** Notes that start together with the same length, velocity and probability sound as one chord. */
interface Group {
  step: number
  length: number
  velocity: number
  probability: number
  notes: Note[]
}

function groupNotes(notes: readonly Note[]): Group[] {
  const sorted = [...notes].sort(
    (a, b) =>
      a.step - b.step ||
      b.length - a.length ||
      b.velocity - a.velocity ||
      b.probability - a.probability ||
      pitchValue(a.pitch) - pitchValue(b.pitch) ||
      noteToken(a).localeCompare(noteToken(b)),
  )
  const groups: Group[] = []
  for (const note of sorted) {
    const last = groups.at(-1)
    if (
      last &&
      last.step === note.step &&
      last.length === note.length &&
      last.velocity === note.velocity &&
      last.probability === note.probability
    ) {
      last.notes.push(note)
    } else {
      groups.push({ ...note, notes: [note] })
    }
  }
  return groups
}

/** Overlapping groups go to separate voices, which become comma-separated layers. */
function assignVoices(groups: readonly Group[]): Group[][] {
  const voices: { end: number; groups: Group[] }[] = []
  for (const group of groups) {
    const voice = voices.find((v) => v.end <= group.step)
    if (voice) {
      voice.groups.push(group)
      voice.end = group.step + group.length
    } else {
      voices.push({ end: group.step + group.length, groups: [group] })
    }
  }
  return voices.map((v) => v.groups)
}

type Segment = { rest: true; length: number } | { rest: false; length: number; group: Group }

function segments(voice: readonly Group[]): Segment[] {
  const result: Segment[] = []
  let cursor = 0
  for (const group of voice) {
    if (group.step > cursor) result.push({ rest: true, length: group.step - cursor })
    result.push({ rest: false, length: group.length, group })
    cursor = group.step + group.length
  }
  if (cursor < STEPS_PER_CYCLE) result.push({ rest: true, length: STEPS_PER_CYCLE - cursor })
  return result
}

/**
 * Writes the segments on the coarsest grid that keeps every onset: all lengths are divided by
 * their greatest common divisor, so eight eighth notes read `0 2 4 5 ...`, not `0@2 2@2 ...`.
 */
function sequence(
  parts: readonly Segment[],
  token: (group: Group) => string,
  onToken?: (group: Group, from: number, to: number) => void,
): string {
  const unit = parts.reduce((acc, part) => gcd(acc, part.length), 0)
  let text = ''
  for (const part of parts) {
    const length = part.length / unit
    if (part.rest) {
      for (let i = 0; i < length; i++) text += (text ? ' ' : '') + '~'
    } else {
      if (text) text += ' '
      const written = length > 1 ? `${token(part.group)}@${String(length)}` : token(part.group)
      onToken?.(part.group, text.length, text.length + written.length)
      text += written
    }
  }
  return text
}

function groupToken(group: Group): string {
  const pitches = group.notes.map(noteToken)
  const base = pitches.length > 1 ? `[${pitches.join(',')}]` : pitches.join('')
  // `?x` removes the event with probability x (see stepToken in steps.ts).
  return group.probability < 1 ? `${base}?${formatNumber(1 - group.probability)}` : base
}

/** Pattern of a note track: `note("...")` or `n("...")` (the caller adds `.scale()`). */
export function notesPattern(content: NoteContent): string {
  return buildNotesPattern(content).code
}

/**
 * Where each note is written in the pattern: `[from, to]` offsets into `notesPattern(content)`,
 * so the piano roll can highlight the code of the selected note.
 */
export function noteTokenRanges(content: NoteContent): Map<string, [number, number]> {
  return buildNotesPattern(content).ranges
}

function buildNotesPattern(content: NoteContent): { code: string; ranges: Map<string, [number, number]> } {
  const fn = content.mode === 'degree' ? 'n' : 'note'
  const ranges = new Map<string, [number, number]>()
  const voices = assignVoices(groupNotes(content.notes)).map((groups) => {
    const parts = segments(groups)
    const tokens: { group: Group; from: number; to: number }[] = []
    return {
      parts,
      tokens,
      pitches: sequence(parts, groupToken, (group, from, to) => tokens.push({ group, from, to })),
      hasVelocity: groups.some((group) => group.velocity !== 1),
    }
  })
  if (voices.length === 0) return { code: `${fn}("~")`, ranges }

  // Each voice text starts at `offset` in the final code.
  const place = (voice: (typeof voices)[number], offset: number) => {
    for (const { group, from, to } of voice.tokens)
      for (const note of group.notes) ranges.set(note.id, [offset + from, offset + to])
  }

  if (!voices.some((voice) => voice.hasVelocity)) {
    let offset = `${fn}("`.length
    for (const voice of voices) {
      place(voice, offset)
      offset += voice.pitches.length + 2
    }
    return { code: `${fn}("${voices.map((v) => v.pitches).join(', ')}")`, ranges }
  }

  // A layered velocity pattern would apply every layer's value to every event (docs/DECISIONS.md),
  // so each voice gets its own pattern.
  const single = voices.length === 1
  let code = single ? '' : 'stack('
  voices.forEach((voice, i) => {
    if (i > 0) code += ', '
    place(voice, code.length + `${fn}("`.length)
    code += `${fn}("${voice.pitches}")`
    if (voice.hasVelocity) code += `.velocity("${sequence(voice.parts, (group) => formatNumber(group.velocity))}")`
  })
  return { code: single ? code : `${code})`, ranges }
}
