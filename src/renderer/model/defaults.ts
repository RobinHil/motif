import { nanoid } from 'nanoid'
import {
  PROJECT_VERSION,
  STEPS_PER_CYCLE,
  TRACK_COLORS,
  type ID,
  type ParamKey,
  type Project,
  type Step,
  type StepRow,
  type Track,
  type TrackColor,
  type TrackKind,
  type TransformInstance,
  type TransformType,
} from './project'

export type IdFactory = () => ID

export const newId: IdFactory = () => nanoid(12)

/**
 * Strudel's own defaults. A parameter equal to its default is not written (SPEC 4, rule 5),
 * so the default must be what Strudel plays when the call is absent. See docs/DECISIONS.md.
 */
export const PARAM_DEFAULTS: Partial<Record<ParamKey, number>> = { gain: 1, pan: 0.5 }

export const DEFAULT_BPM = 120
export const DEFAULT_BEATS_PER_CYCLE = 4
export const DEFAULT_DRUM_ROWS = ['bd', 'sd', 'hh'] as const

export function emptySteps(): (Step | null)[] {
  return Array.from({ length: STEPS_PER_CYCLE }, () => null)
}

export function createStepRow(sound: string, newIdFn: IdFactory = newId): StepRow {
  return { id: newIdFn(), sound, steps: emptySteps() }
}

export function createProject(name = 'Untitled', now: Date = new Date()): Project {
  const timestamp = now.toISOString()
  return {
    version: PROJECT_VERSION,
    meta: { name, createdAt: timestamp, updatedAt: timestamp },
    transport: { bpm: DEFAULT_BPM, beatsPerCycle: DEFAULT_BEATS_PER_CYCLE },
    tracks: [],
    scenes: [],
    arrangement: [],
    automations: [],
    master: { gain: 0.8, compressor: false, limiter: false, width: 1, low: 0, high: 0 },
    sampleLibrary: [],
    midiMappings: [],
  }
}

/** Smallest orbit number not used by any track (one track = one orbit). */
export function nextOrbit(tracks: readonly Track[]): number {
  const used = new Set(tracks.map((t) => t.orbit))
  let orbit = 1
  while (used.has(orbit)) orbit++
  return orbit
}

/** Track colors are assigned in order, then cycled (DESIGN.md). */
export function nextColor(tracks: readonly Track[]): TrackColor {
  return TRACK_COLORS[tracks.length % TRACK_COLORS.length] ?? 'track-1'
}

const DEFAULT_NAMES: Record<TrackKind, string> = { steps: 'Rhythm', notes: 'Notes', code: 'Free code' }

export function createTrack(kind: TrackKind, existing: readonly Track[], newIdFn: IdFactory = newId): Track {
  const base = {
    id: newIdFn(),
    name: `${DEFAULT_NAMES[kind]} ${existing.length + 1}`,
    color: nextColor(existing),
    orbit: nextOrbit(existing),
    mute: false,
    solo: false,
    params: { gain: 1, pan: 0.5 },
    transforms: [],
  }
  switch (kind) {
    case 'steps':
      return {
        ...base,
        kind,
        source: { type: 'bank', bank: 'MotifKit' },
        steps: { stepsPerCycle: STEPS_PER_CYCLE, rows: DEFAULT_DRUM_ROWS.map((s) => createStepRow(s, newIdFn)) },
      }
    case 'notes':
      return {
        ...base,
        kind,
        source: { type: 'synth', name: 'sawtooth' },
        notes: { mode: 'note', stepsPerCycle: STEPS_PER_CYCLE, notes: [] },
      }
    case 'code':
      return { ...base, kind, source: { type: 'synth', name: 'sine' }, code: 'note("c3 e3 g3").s("sine")' }
  }
}

export const TRANSFORM_DEFAULT_ARGS: Record<TransformType, TransformInstance['args']> = {
  fast: { factor: 2 },
  slow: { factor: 2 },
  rev: {},
  jux: {},
  ply: { factor: 2 },
  degradeBy: { amount: 0.3 },
  sometimes: { speed: 2 },
  lastOf: { every: 4, factor: 2 },
  chop: { parts: 8 },
  striate: { parts: 4 },
  slice: { parts: 8, pattern: '0 2 1 3' },
  splice: { parts: 8, pattern: '0 1 2 3 4 5 6 7' },
  loopAt: { cycles: 2 },
  custom: { code: '' },
}

export function createTransform(type: TransformType, newIdFn: IdFactory = newId): TransformInstance {
  return { id: newIdFn(), type, args: { ...TRANSFORM_DEFAULT_ARGS[type] }, enabled: true }
}
