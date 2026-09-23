// Test helper: small builders for codegen tests.
import { createProject, emptySteps } from '../model/defaults'
import type { Note, Project, Step, StepRow, Track } from '../model/project'

export const HIT: Step = { velocity: 1, probability: 1 }

export function stepRow(sound: string, hits: readonly number[], step: Step = HIT, variant?: number): StepRow {
  const steps = emptySteps()
  for (const index of hits) steps[index] = step
  return { id: `row-${sound}`, sound, steps, ...(variant !== undefined ? { variant } : {}) }
}

export function note(step: number, length: number, pitch: Note['pitch'], extra: Partial<Note> = {}): Note {
  return { id: `n${String(step)}-${String(pitch)}`, step, length, pitch, velocity: 1, probability: 1, ...extra }
}

const base = (): Pick<Track, 'name' | 'color' | 'mute' | 'solo' | 'params' | 'transforms'> => ({
  name: 'Track',
  color: 'track-1',
  mute: false,
  solo: false,
  params: { gain: 1, pan: 0.5 },
  transforms: [],
})

export function stepsTrack(rows: StepRow[], extra: Partial<Track> = {}): Track {
  return {
    ...base(),
    id: 'steps',
    orbit: 1,
    kind: 'steps',
    source: { type: 'bank', bank: 'RolandTR909' },
    steps: { stepsPerCycle: 16, rows },
    ...extra,
  }
}

export function notesTrack(notes: Note[], extra: Partial<Track> = {}): Track {
  return {
    ...base(),
    id: 'notes',
    orbit: 2,
    kind: 'notes',
    source: { type: 'synth', name: 'sawtooth' },
    notes: { mode: 'note', stepsPerCycle: 16, notes },
    ...extra,
  }
}

export function codeTrack(code: string, extra: Partial<Track> = {}): Track {
  return {
    ...base(),
    id: 'code',
    orbit: 3,
    kind: 'code',
    source: { type: 'synth', name: 'sine' },
    code,
    ...extra,
  }
}

export function project(tracks: Track[], extra: Partial<Project> = {}): Project {
  return { ...createProject('Test', new Date(0)), tracks, ...extra }
}
