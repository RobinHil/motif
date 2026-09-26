// The two tek tracks shipped with Motif: the one the tutorial builds step by step, and "demo", the
// project the app opens on first launch as if the user had made it. Original compositions: hard
// tek kicks, a rolling psytrance bass, acid, a melodic break and an industrial ending, played only
// with bundled sounds. Pure data.
import { createProject, emptySteps } from '../model/defaults'
import type {
  ArrangementBlock,
  Automation,
  Modulation,
  Note,
  Project,
  Scene,
  Step,
  StepRow,
  Track,
  TrackColor,
} from '../model/project'

const hit = (velocity = 1): Step => ({ velocity, probability: 1 })

function row(
  id: string,
  sound: string,
  hits: readonly number[],
  options: { variant?: number; velocity?: number } = {},
): StepRow {
  const steps = emptySteps()
  for (const index of hits) steps[index] = hit(options.velocity)
  return { id, sound, steps, ...(options.variant === undefined ? {} : { variant: options.variant }) }
}

function note(id: string, step: number, length: number, pitch: Note['pitch'], alternatives?: Note['pitch'][]): Note {
  return { id, step, length, pitch, velocity: 1, probability: 1, ...(alternatives ? { alternatives } : {}) }
}

interface TrackBase {
  id: string
  name: string
  color: TrackColor
  orbit: number
  params?: Partial<Track['params']>
}

/** A kick stops the ring of the previous one, like on a drum machine: `.cut(1)`. */
const cutGroup = (id: string): Track['transforms'][number] => ({
  id,
  type: 'custom',
  args: { code: '.cut(1)' },
  enabled: true,
})

function stepsTrack(base: TrackBase, bank: string, rows: StepRow[], transforms: Track['transforms'] = []): Track {
  return {
    ...base,
    kind: 'steps',
    mute: false,
    solo: false,
    source: { type: 'bank', bank },
    params: { gain: 1, pan: 0.5, ...base.params },
    transforms,
    steps: { stepsPerCycle: 16, rows },
  }
}

function notesTrack(base: TrackBase, source: Track['source'], notes: Note[]): Track {
  return {
    ...base,
    kind: 'notes',
    mute: false,
    solo: false,
    source,
    params: { gain: 1, pan: 0.5, ...base.params },
    transforms: [],
    notes: { mode: 'note', stepsPerCycle: 16, notes },
  }
}

function codeTrack(base: TrackBase, code: string): Track {
  return {
    ...base,
    kind: 'code',
    mute: false,
    solo: false,
    source: { type: 'synth', name: 'sawtooth' },
    params: { gain: 1, pan: 0.5, ...base.params },
    transforms: [],
    code,
  }
}

const sine = (min: number, max: number, cycles: number): Modulation => ({
  kind: 'signal',
  shape: 'sine',
  min,
  max,
  cycles,
})

// ---------------------------------------------------------------------------------------------
// The tutorial track: 150 BPM, F phrygian.

export const TUTORIAL_BPM = 150

/** Steps 1, 5, 9, 13: four on the floor. */
export const FOUR_ON_THE_FLOOR = [0, 4, 8, 12]

export const tutorialKick = (): Track =>
  stepsTrack(
    { id: 'tut-kick', name: 'Kick', color: 'track-1', orbit: 1, params: { gain: 0.5 } },
    'MotifKit',
    [row('tut-kick-tek', 'tek', FOUR_ON_THE_FLOOR)],
    [cutGroup('tut-kick-cut')],
  )

export const tutorialHats = (): Track =>
  stepsTrack({ id: 'tut-hats', name: 'Hats', color: 'track-2', orbit: 2, params: { gain: 0.9 } }, 'MotifKit', [
    row('tut-hats-oh', 'oh', [2, 6, 10, 14]),
    row('tut-hats-hh', 'hh', [1, 3, 5, 7, 9, 11, 13, 15], { velocity: 0.5 }),
    row('tut-hats-cp', 'cp', [4, 12]),
  ])

/** Psytrance rolling bass: the three 16ths after each kick, a turn at the end of each bar. */
export const tutorialBass = (): Track => {
  const steps = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15]
  return notesTrack(
    {
      id: 'tut-bass',
      name: 'Bass',
      color: 'track-3',
      orbit: 3,
      params: { gain: 1.3, lpf: 650, lpq: 4, shape: 0.35 },
    },
    { type: 'synth', name: 'sawtooth' },
    steps.map((step, i) =>
      step === 15
        ? note(`tut-bass-${String(i)}`, step, 1, 'f1', ['c2', 'f1', 'eb2'])
        : step === 14
          ? note(`tut-bass-${String(i)}`, step, 1, 'f1', ['f1', 'f1', 'c2'])
          : note(`tut-bass-${String(i)}`, step, 1, 'f1'),
    ),
  )
}

/** Acid line: sixteen 16ths around F, octave jumps, the flat second of phrygian. */
const ACID = ['f2', 'f2', 'f3', 'f2', 'ab2', 'f2', 'c3', 'f2', 'f2', 'eb3', 'f2', 'gb2', 'f3', 'f2', 'c3', 'eb3']

export const tutorialAcid = (): Track =>
  notesTrack(
    {
      id: 'tut-acid',
      name: 'Acid',
      color: 'track-4',
      orbit: 4,
      params: { gain: 0.55, lpf: 800, lpq: 18, delay: 0.25, delaytime: 0.3, delayfeedback: 0.35, shape: 0.45 },
    },
    { type: 'synth', name: 'sawtooth' },
    ACID.map((pitch, step) =>
      step === 2
        ? note(`tut-acid-${String(step)}`, step, 1, pitch, ['ab3', 'f3', 'c4'])
        : note(`tut-acid-${String(step)}`, step, 1, pitch),
    ),
  )

/** The acid filter opens and closes over 8 cycles: the classic acid sweep. */
export const ACID_SWEEP = sine(300, 3200, 8)

/** F minor, D flat, E flat, then C major for the pull back to F (harmonic minor). */
export const tutorialChords = (): Track =>
  notesTrack(
    {
      id: 'tut-chords',
      name: 'Chords',
      color: 'track-1',
      orbit: 5,
      params: { gain: 0.5, lpf: 1400, room: 0.6, size: 0.8, attack: 0.4, release: 0.8 },
    },
    { type: 'synth', name: 'sawtooth' },
    [
      note('tut-chords-1', 0, 16, 'f3', ['f3', 'g3', 'g3']),
      note('tut-chords-2', 0, 16, 'ab3', ['ab3', 'bb3', 'c4']),
      note('tut-chords-3', 0, 16, 'c4', ['db4', 'eb4', 'e4']),
    ],
  )

/** Arpeggio on the same chords, one per cycle. */
const ARP: [Note['pitch'], Note['pitch'][]][] = [
  ['c5', ['db5', 'eb5', 'e5']],
  ['ab4', ['ab4', 'bb4', 'c5']],
  ['f4', ['f4', 'g4', 'g4']],
  ['ab4', ['ab4', 'bb4', 'c5']],
  ['c5', ['db5', 'eb5', 'e5']],
  ['f5', ['f5', 'g5', 'g5']],
  ['eb5', ['eb5', 'f5', 'f5']],
  ['c5', ['db5', 'eb5', 'e5']],
]

export const tutorialLead = (): Track =>
  notesTrack(
    {
      id: 'tut-lead',
      name: 'Lead',
      color: 'track-2',
      orbit: 6,
      params: { gain: 0.65, room: 0.45, delay: 0.35, delaytime: 0.3, delayfeedback: 0.4 },
    },
    { type: 'sample', name: 'pluck' },
    ARP.map(([pitch, alternatives], i) => note(`tut-lead-${String(i)}`, i * 2, 2, pitch, alternatives)),
  )

export const RAGE_CODE = `note("<f3 f3 ab3 gb3>*8").s("sawtooth")
  .vowel("<a e o i>").distort(3).hpf(500)
  .lpf(sine.range(1200, 7000).fast(2))`

export const tutorialRage = (): Track =>
  codeTrack({ id: 'tut-rage', name: 'Rage', color: 'track-3', orbit: 7, params: { gain: 0.45 } }, RAGE_CODE)

export const INDUS_CODE = `stack(
  s("tek:2").struct("x ~ ~ x ~ ~ x ~ x ~ ~ x ~ ~ x ~").distort(2).distortvol(0.15),
  s("metal").n("<0 1 2 1>*4").speed(perlin.range(0.7, 1.3)).crush(6).room(0.3).postgain(1.2),
  s("static").chop(16).degradeBy(0.4).postgain(0.25)
)`

export const tutorialIndus = (): Track =>
  codeTrack({ id: 'tut-indus', name: 'Indus', color: 'track-4', orbit: 8, params: { gain: 0.45 } }, INDUS_CODE)

export const FX_CODE = `s("<impact ~ ~ ~ ~ ~ riser ~>")`

export const tutorialFx = (): Track =>
  codeTrack({ id: 'tut-fx', name: 'FX', color: 'track-1', orbit: 9, params: { gain: 0.8 } }, FX_CODE)

const scene = (id: string, name: string, lengthCycles: number, trackIds: string[]): Scene => ({
  id: `tut-scene-${id}`,
  name,
  lengthCycles,
  activeTrackIds: trackIds.map((t) => `tut-${t}`),
})

/** The song: intro, build, acid drop, melodic break, drop, rampage, industrial ending, outro. */
export const tutorialScenes = (): Scene[] => [
  scene('intro', 'Intro', 8, ['kick', 'hats']),
  scene('build', 'Build', 8, ['kick', 'hats', 'bass', 'fx']),
  scene('acid', 'Acid drop', 16, ['kick', 'hats', 'bass', 'acid']),
  scene('melodic', 'Melodic', 8, ['chords', 'lead', 'fx']),
  scene('drop', 'Drop', 16, ['kick', 'hats', 'bass', 'acid', 'lead']),
  scene('rage', 'Rampage', 8, ['kick', 'hats', 'bass', 'rage']),
  scene('indus', 'Industrial', 16, ['indus', 'bass', 'hats']),
  scene('outro', 'Outro', 4, ['chords']),
]

function backToBack(scenes: readonly Scene[], prefix: string): ArrangementBlock[] {
  let start = 0
  return scenes.map((s, i) => {
    const block = { id: `${prefix}-${String(i + 1)}`, sceneId: s.id, startCycle: start }
    start += s.lengthCycles
    return block
  })
}

export const tutorialArrangement = (): ArrangementBlock[] => backToBack(tutorialScenes(), 'tut-section')

/** The master filter opens over the intro. */
export const tutorialAutomations = (): Automation[] => [
  {
    id: 'tut-automation-lpf',
    target: { trackId: 'master', param: 'lpf' },
    points: [
      { cycle: 0, value: 500 },
      { cycle: 8, value: 12000 },
    ],
  },
]

export const TUTORIAL_MASTER: Project['master'] = {
  gain: 0.85,
  compressor: true,
  limiter: true,
  width: 1,
  low: 0,
  high: 0,
}

/** Where the tutorial starts: an empty project at the default tempo. */
export function createTutorialStart(now: Date = new Date()): Project {
  return createProject('Tutorial', now)
}

/** The finished tutorial track, as "Do it for me" on every step leaves it. */
export function createTutorialTrack(now: Date = new Date()): Project {
  const acid = tutorialAcid()
  acid.params.lpf = ACID_SWEEP
  const kick = tutorialKick()
  kick.params.shape = 0.3
  return {
    ...createTutorialStart(now),
    transport: { bpm: TUTORIAL_BPM, beatsPerCycle: 4 },
    tracks: [
      kick,
      tutorialHats(),
      tutorialBass(),
      acid,
      tutorialChords(),
      tutorialLead(),
      tutorialRage(),
      tutorialIndus(),
      tutorialFx(),
    ],
    scenes: tutorialScenes(),
    arrangement: tutorialArrangement(),
    automations: tutorialAutomations(),
    master: { ...TUTORIAL_MASTER },
  }
}

// ---------------------------------------------------------------------------------------------
// "demo": the project opened on first launch, as if the user had made it. 155 BPM, G minor.

export function createStarterDemo(now: Date = new Date()): Project {
  const kick = stepsTrack(
    { id: 'demo-kick', name: 'Kick', color: 'track-1', orbit: 1, params: { gain: 0.5, shape: 0.15 } },
    'MotifKit',
    [{ ...row('demo-kick-tek', 'tek', FOUR_ON_THE_FLOOR), variant: 1 }],
    [cutGroup('demo-kick-cut')],
  )
  const perc = stepsTrack(
    { id: 'demo-perc', name: 'Perc', color: 'track-2', orbit: 2, params: { gain: 0.9 } },
    'MotifKit',
    [
      row('demo-perc-oh', 'oh', [2, 6, 10, 14]),
      row('demo-perc-metal', 'metal', [7, 15], { variant: 2, velocity: 0.7 }),
      row('demo-perc-cp', 'cp', [4, 12]),
    ],
  )
  // Tek bass: long offbeat notes, a darker turn every other bar.
  const reese = notesTrack(
    { id: 'demo-reese', name: 'Reese', color: 'track-3', orbit: 3, params: { gain: 1.3, lpf: 900, shape: 0.5 } },
    { type: 'synth', name: 'sawtooth' },
    [2, 6, 10, 14].map((step, i) =>
      note(`demo-reese-${String(i)}`, step, 2, 'g1', i === 3 ? ['bb1'] : i === 2 ? ['f1'] : undefined),
    ),
  )
  const acid = notesTrack(
    {
      id: 'demo-acid',
      name: 'Acid',
      color: 'track-4',
      orbit: 4,
      params: {
        gain: 0.65,
        lpf: { kind: 'signal', shape: 'saw', min: 400, max: 2800, cycles: 4 },
        lpq: 16,
        shape: 0.4,
        delay: 0.2,
      },
    },
    { type: 'synth', name: 'sawtooth' },
    ['g2', 'g2', 'bb2', 'g2', 'd3', 'g2', 'f3', 'g2', 'g2', 'ab2', 'g2', 'c3', 'g3', 'g2', 'd3', 'f3'].map(
      (pitch, step) => note(`demo-acid-${String(step)}`, step, 1, pitch),
    ),
  )
  const screech = codeTrack(
    { id: 'demo-screech', name: 'Screech', color: 'track-1', orbit: 5, params: { gain: 0.7 } },
    `note("g4 [g4 bb4] f4 d5").s("square").vowel("<o a>").distort(2).hpf(900).fast(2)`,
  )
  const scenes: Scene[] = [
    { id: 'demo-scene-intro', name: 'Intro', lengthCycles: 8, activeTrackIds: ['demo-kick', 'demo-perc'] },
    {
      id: 'demo-scene-drop',
      name: 'Drop',
      lengthCycles: 16,
      activeTrackIds: ['demo-kick', 'demo-perc', 'demo-reese', 'demo-acid', 'demo-screech'],
    },
    { id: 'demo-scene-break', name: 'Break', lengthCycles: 8, activeTrackIds: ['demo-acid', 'demo-screech'] },
  ]
  const order = [scenes[0], scenes[1], scenes[2], scenes[1]].filter((s): s is Scene => s !== undefined)
  return {
    ...createProject('demo', now),
    transport: { bpm: 155, beatsPerCycle: 4 },
    tracks: [kick, perc, reese, acid, screech],
    scenes,
    arrangement: backToBack(order, 'demo-section'),
    master: { ...TUTORIAL_MASTER, gain: 0.8 },
  }
}
