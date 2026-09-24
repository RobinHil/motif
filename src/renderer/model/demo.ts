import { createProject, emptySteps } from './defaults'
import type { ArrangementBlock, Automation, Note, Project, Scene, Step, StepRow, Track } from './project'

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

const scene = (id: string, name: string, lengthCycles: number, tracks: Track[]): Scene => ({
  id: `demo-scene-${id}`,
  name,
  lengthCycles,
  activeTrackIds: tracks.map((t) => t.id),
})

const scenes: Scene[] = [
  scene('intro', 'Intro', 8, [lead, texture]),
  scene('verse', 'Verse', 16, [drums, bass, texture]),
  scene('chorus', 'Chorus', 8, [drums, bass, lead, texture]),
  scene('drop', 'Drop', 16, [drums, bass, lead]),
  scene('outro', 'Outro', 8, [texture]),
]

/** The song of the mockup (5-arrangement.png): every scene once, back to back. */
const arrangement: ArrangementBlock[] = scenes.map((s, i) => ({
  id: `demo-section-${String(i + 1)}`,
  sceneId: s.id,
  startCycle: scenes.slice(0, i).reduce((sum, previous) => sum + previous.lengthCycles, 0),
}))

/** The master filter opens through the verse, opens fully for the drop and closes in the outro. */
const automations: Automation[] = [
  {
    id: 'demo-automation-lpf',
    target: { trackId: 'master', param: 'lpf' },
    points: [
      { cycle: 0, value: 600 },
      { cycle: 8, value: 600 },
      { cycle: 24, value: 2500 },
      { cycle: 31, value: 2800 },
      { cycle: 32, value: 6000 },
      { cycle: 48, value: 6000 },
      { cycle: 56, value: 500 },
    ],
  },
]

/** The project loaded on first launch (SPEC 10, onboarding): Drums, Bass, Lead, Texture, and a song. */
export function createDemoProject(now: Date = new Date()): Project {
  return {
    ...createProject('Demo', now),
    tracks: structuredClone([drums, bass, lead, texture]),
    scenes: structuredClone(scenes),
    arrangement: structuredClone(arrangement),
    automations: structuredClone(automations),
  }
}
