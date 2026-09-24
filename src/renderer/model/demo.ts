import { createProject, emptySteps } from './defaults'
import type { Note, Project, Step, StepRow, Track } from './project'

const HIT: Step = { velocity: 1, probability: 1 }

function row(id: string, sound: string, hits: readonly number[]): StepRow {
  const steps = emptySteps()
  for (const index of hits) steps[index] = HIT
  return { id, sound, steps }
}

function note(id: string, step: number, length: number, pitch: Note['pitch'], alternatives?: Note['pitch'][]): Note {
  return { id, step, length, pitch, velocity: 1, probability: 1, ...(alternatives ? { alternatives } : {}) }
}

const drums: Track = {
  id: 'demo-drums',
  name: 'Drums',
  color: 'track-1',
  orbit: 1,
  kind: 'steps',
  mute: false,
  solo: false,
  source: { type: 'bank', bank: 'MotifKit' },
  params: { gain: 1, pan: 0.5 },
  transforms: [],
  steps: {
    stepsPerCycle: 16,
    rows: [
      row('demo-drums-bd', 'bd', [0, 8, 10]),
      row('demo-drums-sd', 'sd', [4, 12]),
      row('demo-drums-hh', 'hh', [0, 2, 4, 6, 8, 10, 12, 14, 15]),
    ],
  },
}

const bass: Track = {
  id: 'demo-bass',
  name: 'Bass',
  color: 'track-2',
  orbit: 2,
  kind: 'notes',
  mute: false,
  solo: false,
  source: { type: 'synth', name: 'sawtooth' },
  params: { gain: 1, pan: 0.5, lpf: { kind: 'signal', shape: 'sine', min: 300, max: 1200, cycles: 4 } },
  transforms: [],
  notes: {
    mode: 'note',
    stepsPerCycle: 16,
    notes: [
      note('demo-bass-1', 0, 4, 'c2'),
      note('demo-bass-2', 4, 4, 'c2'),
      note('demo-bass-3', 8, 4, 'eb2'),
      note('demo-bass-4', 12, 4, 'g1'),
    ],
  },
}

const lead: Track = {
  id: 'demo-lead',
  name: 'Lead',
  color: 'track-3',
  orbit: 3,
  kind: 'notes',
  mute: false,
  solo: false,
  source: { type: 'synth', name: 'triangle' },
  params: { gain: 1, pan: 0.5, room: 0.4 },
  transforms: [{ id: 'demo-lead-jux', type: 'jux', args: {}, enabled: true }],
  notes: {
    mode: 'degree',
    scale: 'C:minor',
    stepsPerCycle: 16,
    notes: [
      note('demo-lead-1', 0, 2, 0),
      note('demo-lead-2', 2, 2, 2),
      note('demo-lead-3', 4, 2, 4),
      note('demo-lead-4', 6, 2, 5, [7]),
      note('demo-lead-5', 10, 2, 4),
      note('demo-lead-6', 12, 2, 2),
    ],
  },
}

const texture: Track = {
  id: 'demo-texture',
  name: 'Texture',
  color: 'track-4',
  orbit: 4,
  kind: 'code',
  mute: false,
  solo: false,
  source: { type: 'synth', name: 'sine' },
  params: { gain: 1, pan: 0.5 },
  transforms: [],
  code: 's("wind*2").speed(perlin.range(0.5, 1.5)).chop(8).degradeBy(0.3)',
}

/** The project loaded on first launch (SPEC 10, onboarding): Drums, Bass, Lead, Texture. */
export function createDemoProject(now: Date = new Date()): Project {
  return { ...createProject('Demo', now), tracks: structuredClone([drums, bass, lead, texture]) }
}
