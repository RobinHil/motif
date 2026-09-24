// Scale arithmetic for the piano roll: degrees (n + scale) to pitches and back. Matches Strudel's
// .scale() (tonal), which a test checks against the installed Strudel.

export const SCALE_TYPES: { name: string; label: string; intervals: number[] }[] = [
  { name: 'major', label: 'major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'minor', label: 'minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'dorian', label: 'dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'phrygian', label: 'phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'lydian', label: 'lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'mixolydian', label: 'mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: 'locrian', label: 'locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
  { name: 'harmonic:minor', label: 'harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: 'melodic:minor', label: 'melodic minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
  { name: 'major:pentatonic', label: 'major pentatonic', intervals: [0, 2, 4, 7, 9] },
  { name: 'minor:pentatonic', label: 'minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  { name: 'chromatic', label: 'chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
]

export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SHARP_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

export interface ParsedScale {
  /** MIDI number of degree 0. */
  root: number
  intervals: number[]
}

/** `C:minor`, `D4:harmonic:minor`. Returns null for scales outside SCALE_TYPES. */
export function parseScale(scale: string): ParsedScale | null {
  const match = /^([A-Ga-g])([#b]?)(\d?):(.+)$/.exec(scale)
  if (!match) return null
  const [, letter = 'C', accidental = '', octave = '', type = ''] = match
  const intervals = SCALE_TYPES.find((t) => t.name === type)?.intervals
  if (!intervals) return null
  const pc = (PITCH_CLASS[letter.toUpperCase()] ?? 0) + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
  return { root: (Number(octave || '3') + 1) * 12 + pc, intervals }
}

const mod = (a: number, n: number) => ((a % n) + n) % n

export function degreeToMidi(degree: number, scale: ParsedScale): number {
  const n = scale.intervals.length
  return scale.root + (scale.intervals[mod(degree, n)] ?? 0) + 12 * Math.floor(degree / n)
}

/** Whether a pitch belongs to the scale, in any octave. */
export function inScale(midi: number, scale: ParsedScale): boolean {
  return scale.intervals.includes(mod(midi - scale.root, 12))
}

/** The degree whose pitch is nearest to `midi` (the lower one on a tie). */
export function nearestDegree(midi: number, scale: ParsedScale): number {
  const n = scale.intervals.length
  let degree = Math.floor(((midi - scale.root) / 12) * n) - n
  let best = degree
  let distance = Number.POSITIVE_INFINITY
  for (let i = 0; i < 3 * n; i++, degree++) {
    const d = Math.abs(degreeToMidi(degree, scale) - midi)
    if (d < distance) {
      distance = d
      best = degree
    }
  }
  return best
}

/** Nearest pitch of the scale (for "snap to scale"). */
export function snapToScale(midi: number, scale: ParsedScale): number {
  return degreeToMidi(nearestDegree(midi, scale), scale)
}

/** `61` -> `c#4`: the note name written in code (sharps, lowercase). */
export function midiToNoteName(midi: number): string {
  return `${SHARP_NAMES[mod(midi, 12)] ?? 'c'}${String(Math.floor(midi / 12) - 1)}`
}

/** `c#4` -> `C#4`, `eb3` -> `Eb3`: how note names are shown in the interface. */
export function displayNoteName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}
