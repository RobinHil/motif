// The two songs shipped with Motif: "Tutorial", which the tutorial builds step by step, and
// "demo", opened on first launch as if the user had made it. Original compositions: hard tek
// kicks and a psytrance roll, a written chord progression that every part follows, a lead hook,
// a slow theme for the breakdown, acid, an angry screech and an industrial finale where the hook
// comes back saturated. Only bundled sounds. Pure data.
import { noteNameToMidi } from '../codegen/notes'
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

// ---------------------------------------------------------------------------------------------
// Composition helpers.

const FLAT_NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b']
const nameOf = (midi: number) => `${FLAT_NAMES[((midi % 12) + 12) % 12] ?? 'c'}${String(Math.floor(midi / 12) - 1)}`
const transpose = (name: string, semitones: number) => nameOf(noteNameToMidi(name) + semitones)

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

/** Where notes start in a bar and how long they last, in 16th-note steps. */
type Rhythm = readonly (readonly [step: number, length: number])[]

/**
 * A line written bar by bar on one rhythm: note i of the first bar plays on the first cycle, the
 * same note of the next bars on the next cycles (`<a b c ...>` in the code).
 */
function line(prefix: string, rhythm: Rhythm, bars: readonly (readonly string[])[]): Note[] {
  return rhythm.map(([step, length], i) => {
    const pitches = bars.map((bar) => bar[i] ?? bar[bar.length - 1] ?? 'c3')
    const [first = 'c3', ...rest] = pitches
    return {
      id: `${prefix}-${String(i)}`,
      step,
      length,
      pitch: first,
      velocity: 1,
      probability: 1,
      ...(rest.length > 0 && rest.some((p) => p !== first) ? { alternatives: rest } : {}),
    }
  })
}

/** Chords held for the whole bar, one voice per note, from bar-by-bar voicings. */
function chords(prefix: string, voicings: readonly (readonly string[])[]): Note[] {
  const voices = voicings[0]?.length ?? 0
  return Array.from({ length: voices }, (_, v) =>
    line(
      `${prefix}-${String(v)}`,
      [[0, 16]],
      voicings.map((c) => [c[v] ?? 'c3']),
    ),
  ).flat()
}

/** Psytrance roll: the three 16ths after each kick, on the root of each bar. */
const ROLL: Rhythm = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((step) => [step, 1] as const)

/** An acid lick given in semitones above the root, moved to the root of each bar. */
function acid(prefix: string, roots: readonly string[], lick: readonly number[]): Note[] {
  return line(
    prefix,
    lick.map((_, step) => [step, 1] as const),
    roots.map((root) => lick.map((semitones) => transpose(root, semitones))),
  )
}

/** The same bars as mini-notation, one `[...]` per bar, 16 slots each: for free code. */
function mini(rhythm: Rhythm, bars: readonly (readonly string[])[]): string {
  const bar = (notes: readonly string[]) => {
    const slots = Array.from({ length: 16 }, () => '~')
    rhythm.forEach(([step], i) => {
      slots[step] = notes[i] ?? '~'
    })
    return `[${slots.join(' ')}]`
  }
  return `<${bars.map(bar).join('\n    ')}>`
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

interface SceneSpec {
  id: string
  name: string
  bars: number
  tracks: string[]
}

function scenesOf(prefix: string, specs: readonly SceneSpec[]): Scene[] {
  const byId = new Map<string, Scene>()
  for (const spec of specs)
    byId.set(spec.id, {
      id: `${prefix}-scene-${spec.id}`,
      name: spec.name,
      lengthCycles: spec.bars,
      activeTrackIds: spec.tracks.map((t) => `${prefix}-${t}`),
    })
  return [...byId.values()]
}

/** Sections back to back, in the order of `specs` (a scene may come back). */
function sectionsOf(prefix: string, specs: readonly SceneSpec[]): ArrangementBlock[] {
  let start = 0
  return specs.map((spec, i) => {
    const block = { id: `${prefix}-section-${String(i + 1)}`, sceneId: `${prefix}-scene-${spec.id}`, startCycle: start }
    start += spec.bars
    return block
  })
}

const MASTER: Project['master'] = { gain: 0.85, compressor: true, limiter: true, width: 1, low: 0, high: 0 }

// ---------------------------------------------------------------------------------------------
// "Tutorial": F minor, 150 BPM, about 3 min 40.
//
// Progression, one chord per bar: Fm Db Ab Eb Fm Db Bbm C. The C major chord (harmonic minor)
// pulls back to F; every part follows it.

export const TUTORIAL_BPM = 150

/** Steps 1, 5, 9, 13: four on the floor. */
export const FOUR_ON_THE_FLOOR = [0, 4, 8, 12]

const T_ROOTS = ['f1', 'db1', 'ab1', 'eb1', 'f1', 'db1', 'bb1', 'c2']

/** Four-voice chords: a low root, then close voicings that move as little as possible. */
const T_CHORDS = [
  ['f2', 'f3', 'ab3', 'c4'],
  ['db2', 'f3', 'ab3', 'db4'],
  ['ab2', 'eb3', 'ab3', 'c4'],
  ['eb2', 'eb3', 'g3', 'bb3'],
  ['f2', 'f3', 'ab3', 'c4'],
  ['db2', 'f3', 'ab3', 'db4'],
  ['bb2', 'f3', 'bb3', 'db4'],
  ['c3', 'e3', 'g3', 'c4'],
]

/** The hook: a call on the first half of each bar, an answer on the second. */
export const T_HOOK_RHYTHM: Rhythm = [
  [0, 2],
  [2, 1],
  [3, 2],
  [5, 2],
  [7, 2],
  [9, 2],
  [11, 2],
  [13, 3],
]
export const T_HOOK = [
  ['c5', 'c5', 'ab4', 'c5', 'f5', 'eb5', 'c5', 'ab4'],
  ['db5', 'db5', 'ab4', 'db5', 'f5', 'eb5', 'db5', 'c5'],
  ['c5', 'c5', 'ab4', 'c5', 'eb5', 'g5', 'f5', 'eb5'],
  ['bb4', 'bb4', 'g4', 'bb4', 'eb5', 'f5', 'g5', 'f5'],
  ['c5', 'c5', 'ab4', 'c5', 'f5', 'eb5', 'c5', 'ab4'],
  ['db5', 'db5', 'ab4', 'db5', 'f5', 'ab5', 'g5', 'f5'],
  ['f5', 'f5', 'db5', 'f5', 'bb5', 'ab5', 'f5', 'db5'],
  ['e5', 'e5', 'c5', 'e5', 'g5', 'f5', 'e5', 'c5'],
]

/** The breakdown theme: long notes, a step down, a landing on a chord tone. */
const T_THEME_RHYTHM: Rhythm = [
  [0, 6],
  [6, 2],
  [8, 8],
]
const T_THEME = [
  ['f5', 'eb5', 'c5'],
  ['db5', 'c5', 'ab4'],
  ['c5', 'eb5', 'g5'],
  ['f5', 'eb5', 'bb4'],
  ['ab5', 'g5', 'f5'],
  ['ab5', 'f5', 'db5'],
  ['bb4', 'db5', 'f5'],
  ['g5', 'e5', 'c5'],
]

/** Acid lick in semitones over each root: octave jumps and the flat second of phrygian. */
const T_ACID = [0, 0, 12, 0, 3, 0, 7, 0, 0, 10, 0, 1, 12, 0, 7, 10]

export const tutorialKick = (): Track =>
  stepsTrack(
    { id: 'tut-kick', name: 'Kick', color: 'track-1', orbit: 1, params: { gain: 0.5 } },
    'MotifKit',
    [row('tut-kick-tek', 'tek', FOUR_ON_THE_FLOOR)],
    [cutGroup('tut-kick-cut')],
  )

export const tutorialHats = (): Track =>
  stepsTrack({ id: 'tut-hats', name: 'Hats', color: 'track-2', orbit: 2, params: { gain: 1.2 } }, 'MotifKit', [
    row('tut-hats-oh', 'oh', [2, 6, 10, 14]),
    row('tut-hats-hh', 'hh', [1, 3, 5, 7, 9, 11, 13, 15], { velocity: 0.5 }),
    row('tut-hats-cp', 'cp', [4, 12]),
  ])

export const tutorialBass = (): Track =>
  notesTrack(
    { id: 'tut-bass', name: 'Bass', color: 'track-3', orbit: 3, params: { gain: 1.3, lpf: 650, lpq: 4, shape: 0.35 } },
    { type: 'synth', name: 'sawtooth' },
    line(
      'tut-bass',
      ROLL,
      T_ROOTS.map((root, bar) => ROLL.map((_, i) => (bar === 7 && i === 11 ? transpose(root, 12) : root))),
    ),
  )

export const tutorialPads = (): Track =>
  notesTrack(
    {
      id: 'tut-pads',
      name: 'Pads',
      color: 'track-4',
      orbit: 4,
      params: { gain: 0.45, lpf: 1500, room: 0.7, size: 0.9, attack: 0.5, release: 1.2 },
    },
    { type: 'synth', name: 'sawtooth' },
    chords('tut-pads', T_CHORDS),
  )

export const tutorialLead = (): Track =>
  notesTrack(
    {
      id: 'tut-lead',
      name: 'Lead',
      color: 'track-1',
      orbit: 5,
      params: { gain: 1.5, lpf: 4500, shape: 0.2, room: 0.35, delay: 0.3, delaytime: 0.3, delayfeedback: 0.35 },
    },
    { type: 'synth', name: 'supersaw' },
    line('tut-lead', T_HOOK_RHYTHM, T_HOOK),
  )

export const tutorialTheme = (): Track =>
  notesTrack(
    {
      id: 'tut-theme',
      name: 'Theme',
      color: 'track-2',
      orbit: 6,
      params: { gain: 0.6, room: 0.55, size: 0.8, delay: 0.3, delaytime: 0.4, delayfeedback: 0.45 },
    },
    { type: 'sample', name: 'epiano' },
    line('tut-theme', T_THEME_RHYTHM, T_THEME),
  )

export const tutorialAcid = (): Track =>
  notesTrack(
    {
      id: 'tut-acid',
      name: 'Acid',
      color: 'track-3',
      orbit: 7,
      params: { gain: 0.55, lpf: 800, lpq: 18, shape: 0.45, delay: 0.25, delaytime: 0.3, delayfeedback: 0.35 },
    },
    { type: 'synth', name: 'sawtooth' },
    acid(
      'tut-acid',
      T_ROOTS.map((root) => transpose(root, 12)),
      T_ACID,
    ),
  )

/** The acid filter opens and closes over 16 cycles. */
export const ACID_SWEEP = sine(300, 3500, 16)

export const ARP_CODE = `note(\`<[f4,ab4,c5] [f4,ab4,db5] [eb4,ab4,c5] [eb4,g4,bb4]
    [f4,ab4,c5] [f4,ab4,db5] [f4,bb4,db5] [e4,g4,c5]>\`)
  .arp("0 1 2 1 0 2 1 2 0 1 2 1 2 1 0 1").s("pluck")
  .room(0.4).delay(0.25).pan(sine.range(0.3, 0.7).slow(4))`

export const tutorialArp = (): Track =>
  codeTrack({ id: 'tut-arp', name: 'Arp', color: 'track-4', orbit: 8, params: { gain: 0.55 } }, ARP_CODE)

/** Build-ups: a snare roll that doubles every bar over the last four bars, and a riser. */
export const BUILD_CODE = `stack(
  s("<~ ~ ~ ~ sd*4 sd*8 sd*16 sd*32>").bank("MotifKit").postgain(0.7),
  s("<~ ~ ~ ~ ~ [~ riser] ~ ~>")
)`

export const tutorialBuild = (): Track =>
  codeTrack({ id: 'tut-build', name: 'Build FX', color: 'track-1', orbit: 9, params: { gain: 0.8 } }, BUILD_CODE)

/** The first beat of a drop: impact and crash together. */
export const IMPACT_CODE = `s("<[impact, cr] ~ ~ ~ ~ ~ ~ ~>").bank("MotifKit")`

export const tutorialImpact = (): Track =>
  codeTrack({ id: 'tut-impact', name: 'Impact', color: 'track-2', orbit: 10, params: { gain: 0.8 } }, IMPACT_CODE)

/** The angry part: a screech riff on the chord roots, octaves and fifths, through vowels. */
export const RAGE_CODE = `note("<f3 db3 ab3 eb3 f3 db3 bb3 c4>"
    .add("0 12 0 7 0 12 7 12"))
  .s("sawtooth").vowel("<a e o i>/2")
  .distort(3).distortvol(0.6)
  .lpf(sine.range(1500, 6000).fast(2))`

export const tutorialRage = (): Track =>
  codeTrack({ id: 'tut-rage', name: 'Rage', color: 'track-3', orbit: 11, params: { gain: 0.6 } }, RAGE_CODE)

export const tutorialHardKick = (): Track =>
  stepsTrack(
    { id: 'tut-hardkick', name: 'Hard kick', color: 'track-4', orbit: 12, params: { gain: 0.45, shape: 0.2 } },
    'MotifKit',
    [{ ...row('tut-hardkick-tek', 'tek', FOUR_ON_THE_FLOOR), variant: 1 }],
    [cutGroup('tut-hardkick-cut')],
  )

export const INDUS_CODE = `stack(
  s("metal").n("<0 1 2 1>*4").struct("~ x ~ x ~ x x ~ ~ x ~ x ~ x x x")
    .speed(perlin.range(0.7, 1.3)).crush(6).room(0.3).postgain(0.7),
  s("static").chop(16).degradeBy(0.4).postgain(0.15),
  s("tek:2").struct("~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ x ~ x")
    .distort(2).distortvol(0.1)
)`

export const tutorialIndus = (): Track =>
  codeTrack({ id: 'tut-indus', name: 'Indus', color: 'track-1', orbit: 13, params: { gain: 0.6 } }, INDUS_CODE)

/** The finale: the hook comes back, crushed and distorted. */
export const INDUS_HOOK_CODE = `note(\`${mini(T_HOOK_RHYTHM, T_HOOK)}\`)
  .s("square").distort(2).distortvol(0.6).crush(8)
  .lpf(3500).room(0.3)`

export const tutorialIndusHook = (): Track =>
  codeTrack(
    { id: 'tut-indushook', name: 'Indus hook', color: 'track-2', orbit: 14, params: { gain: 0.5 } },
    INDUS_HOOK_CODE,
  )

const T_SONG: SceneSpec[] = [
  { id: 'intro', name: 'Intro', bars: 16, tracks: ['pads', 'arp'] },
  { id: 'build', name: 'Build', bars: 8, tracks: ['kick', 'hats', 'bass', 'pads', 'build'] },
  { id: 'drop', name: 'Drop', bars: 16, tracks: ['impact', 'kick', 'hats', 'bass', 'pads', 'lead'] },
  { id: 'acid', name: 'Acid solo', bars: 16, tracks: ['kick', 'hats', 'bass', 'acid', 'arp'] },
  { id: 'breakdown', name: 'Breakdown', bars: 16, tracks: ['impact', 'pads', 'theme', 'arp'] },
  { id: 'build2', name: 'Build 2', bars: 8, tracks: ['kick', 'bass', 'pads', 'lead', 'build'] },
  { id: 'drop2', name: 'Drop 2', bars: 16, tracks: ['impact', 'kick', 'hats', 'bass', 'lead', 'acid', 'arp'] },
  { id: 'rampage', name: 'Rampage', bars: 16, tracks: ['impact', 'hardkick', 'hats', 'bass', 'rage'] },
  { id: 'finale', name: 'Finale', bars: 16, tracks: ['impact', 'hardkick', 'indus', 'indushook', 'bass', 'pads'] },
  { id: 'outro', name: 'Outro', bars: 8, tracks: ['pads', 'theme'] },
]

export const tutorialScenes = (): Scene[] => scenesOf('tut', T_SONG)
export const tutorialArrangement = (): ArrangementBlock[] => sectionsOf('tut', T_SONG)

/**
 * The pads open over the intro and close over the outro; the whole mix is high-passed over the
 * last bars of each build, then drops back at the drop.
 */
export const tutorialAutomations = (): Automation[] => [
  {
    id: 'tut-automation-pads',
    target: { trackId: 'tut-pads', param: 'lpf' },
    points: [
      { cycle: 0, value: 350 },
      { cycle: 16, value: 1500 },
      { cycle: 128, value: 1500 },
      { cycle: 136, value: 300 },
    ],
  },
  {
    id: 'tut-automation-hpf',
    target: { trackId: 'master', param: 'hpf' },
    points: [
      { cycle: 0, value: 20 },
      { cycle: 16, value: 20 },
      { cycle: 23, value: 500 },
      { cycle: 24, value: 20 },
      { cycle: 72, value: 20 },
      { cycle: 79, value: 700 },
      { cycle: 80, value: 20 },
    ],
  },
]

export const TUTORIAL_MASTER: Project['master'] = { ...MASTER }

/** Where the tutorial starts: an empty project at the default tempo. */
export function createTutorialStart(now: Date = new Date()): Project {
  return createProject('Tutorial', now)
}

/** The finished tutorial song, as "Do it for me" on every step leaves it. */
export function createTutorialTrack(now: Date = new Date()): Project {
  const kick = tutorialKick()
  kick.params.shape = 0.3
  const acidTrack = tutorialAcid()
  acidTrack.params.lpf = ACID_SWEEP
  return {
    ...createTutorialStart(now),
    transport: { bpm: TUTORIAL_BPM, beatsPerCycle: 4 },
    tracks: [
      kick,
      tutorialHats(),
      tutorialBass(),
      tutorialPads(),
      tutorialLead(),
      tutorialTheme(),
      acidTrack,
      tutorialArp(),
      tutorialBuild(),
      tutorialImpact(),
      tutorialRage(),
      tutorialHardKick(),
      tutorialIndus(),
      tutorialIndusHook(),
    ],
    scenes: tutorialScenes(),
    arrangement: tutorialArrangement(),
    automations: tutorialAutomations(),
    master: { ...TUTORIAL_MASTER },
  }
}

// ---------------------------------------------------------------------------------------------
// "demo": G minor, 155 BPM, about 2 min 50, opened on first launch as the user's own project.
//
// Progression: Gm Eb Cm D Gm Bb Eb D, with D major as the dominant. A dotted hook, a tek reese
// bass on the offbeats instead of a roll, the same kind of journey.

const D_ROOTS = ['g1', 'eb1', 'c2', 'd2', 'g1', 'bb1', 'eb1', 'd2']

const D_CHORDS = [
  ['g2', 'g3', 'bb3', 'd4'],
  ['eb2', 'g3', 'bb3', 'eb4'],
  ['c3', 'g3', 'c4', 'eb4'],
  ['d3', 'gb3', 'a3', 'd4'],
  ['g2', 'g3', 'bb3', 'd4'],
  ['bb2', 'f3', 'bb3', 'd4'],
  ['eb2', 'g3', 'bb3', 'eb4'],
  ['d3', 'gb3', 'a3', 'd4'],
]

/** Dotted rhythm: 3 + 3 + 2 + 2 + 2 + 2 + 2. */
const D_HOOK_RHYTHM: Rhythm = [
  [0, 3],
  [3, 3],
  [6, 2],
  [8, 2],
  [10, 2],
  [12, 2],
  [14, 2],
]
const D_HOOK = [
  ['d5', 'bb4', 'g4', 'd5', 'f5', 'd5', 'bb4'],
  ['eb5', 'bb4', 'g4', 'eb5', 'g5', 'f5', 'eb5'],
  ['c5', 'g4', 'eb4', 'c5', 'eb5', 'd5', 'c5'],
  ['d5', 'a4', 'gb4', 'a4', 'd5', 'e5', 'gb5'],
  ['g5', 'd5', 'bb4', 'd5', 'g5', 'a5', 'bb5'],
  ['f5', 'd5', 'bb4', 'd5', 'f5', 'g5', 'f5'],
  ['g5', 'eb5', 'bb4', 'eb5', 'g5', 'f5', 'eb5'],
  ['gb5', 'd5', 'a4', 'd5', 'gb5', 'e5', 'd5'],
]

const D_THEME_RHYTHM: Rhythm = [
  [0, 8],
  [8, 4],
  [12, 4],
]
const D_THEME = [
  ['g5', 'f5', 'd5'],
  ['eb5', 'f5', 'g5'],
  ['c5', 'eb5', 'g5'],
  ['gb5', 'e5', 'd5'],
  ['bb5', 'a5', 'g5'],
  ['f5', 'd5', 'bb4'],
  ['eb5', 'g5', 'bb5'],
  ['a5', 'gb5', 'd5'],
]

const D_ACID = [0, 12, 0, 10, 0, 7, 12, 0, 3, 0, 1, 0, 12, 10, 7, 3]

const D_SONG: SceneSpec[] = [
  { id: 'intro', name: 'Intro', bars: 8, tracks: ['pads', 'perc'] },
  { id: 'build', name: 'Build', bars: 8, tracks: ['kick', 'perc', 'reese', 'pads', 'build'] },
  { id: 'drop', name: 'Drop', bars: 16, tracks: ['impact', 'kick', 'perc', 'reese', 'lead', 'pads'] },
  { id: 'break', name: 'Break', bars: 16, tracks: ['impact', 'pads', 'theme', 'acid'] },
  { id: 'build2', name: 'Build 2', bars: 8, tracks: ['kick', 'reese', 'lead', 'build'] },
  { id: 'drop2', name: 'Drop 2', bars: 16, tracks: ['impact', 'kick', 'perc', 'reese', 'lead', 'acid', 'screech'] },
  { id: 'finale', name: 'Finale', bars: 16, tracks: ['impact', 'kick', 'metal', 'reese', 'screech', 'lead', 'pads'] },
  { id: 'outro', name: 'Outro', bars: 8, tracks: ['pads', 'theme'] },
]

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
  // Tek bass: the offbeats, long, on the root of each bar.
  const reese = notesTrack(
    { id: 'demo-reese', name: 'Reese', color: 'track-3', orbit: 3, params: { gain: 1.3, lpf: 900, shape: 0.5 } },
    { type: 'synth', name: 'sawtooth' },
    line(
      'demo-reese',
      [
        [2, 2],
        [6, 2],
        [10, 2],
        [14, 2],
      ],
      D_ROOTS.map((root) => [root, root, root, transpose(root, 12)]),
    ),
  )
  const pads = notesTrack(
    {
      id: 'demo-pads',
      name: 'Pads',
      color: 'track-4',
      orbit: 4,
      params: { gain: 0.45, lpf: 1300, room: 0.7, size: 0.9, attack: 0.4, release: 1 },
    },
    { type: 'synth', name: 'sawtooth' },
    chords('demo-pads', D_CHORDS),
  )
  const lead = notesTrack(
    {
      id: 'demo-lead',
      name: 'Lead',
      color: 'track-1',
      orbit: 5,
      params: { gain: 1.5, lpf: 5000, shape: 0.25, room: 0.3, delay: 0.3, delaytime: 0.29, delayfeedback: 0.3 },
    },
    { type: 'synth', name: 'supersaw' },
    line('demo-lead', D_HOOK_RHYTHM, D_HOOK),
  )
  const theme = notesTrack(
    { id: 'demo-theme', name: 'Theme', color: 'track-2', orbit: 6, params: { gain: 0.75, room: 0.6, delay: 0.25 } },
    { type: 'sample', name: 'bell' },
    line('demo-theme', D_THEME_RHYTHM, D_THEME),
  )
  const acidLine = notesTrack(
    {
      id: 'demo-acid',
      name: 'Acid',
      color: 'track-3',
      orbit: 7,
      params: {
        gain: 0.55,
        lpf: { kind: 'signal', shape: 'saw', min: 400, max: 3000, cycles: 8 },
        lpq: 16,
        shape: 0.4,
        delay: 0.2,
      },
    },
    { type: 'synth', name: 'sawtooth' },
    acid(
      'demo-acid',
      D_ROOTS.map((root) => transpose(root, 12)),
      D_ACID,
    ),
  )
  const screech = codeTrack(
    { id: 'demo-screech', name: 'Screech', color: 'track-4', orbit: 8, params: { gain: 0.6 } },
    `note("<g3 eb3 c4 d4 g3 bb3 eb3 d4>".add("0 7 12 7 0 12 7 12"))
  .s("square").vowel("<o a>")
  .distort(2).distortvol(0.9).lpf(sine.range(1200, 5000).fast(2))`,
  )
  const build = codeTrack(
    { id: 'demo-build', name: 'Build FX', color: 'track-1', orbit: 9, params: { gain: 0.8 } },
    `stack(
  s("<~ ~ ~ ~ sd*4 sd*8 sd*16 sd*32>").bank("MotifKit").postgain(0.7),
  s("<~ ~ ~ ~ ~ [~ riser] ~ ~>")
)`,
  )
  const impact = codeTrack(
    { id: 'demo-impact', name: 'Impact', color: 'track-2', orbit: 10, params: { gain: 0.8 } },
    `s("<[impact, cr] ~ ~ ~ ~ ~ ~ ~>").bank("MotifKit")`,
  )
  const metal = codeTrack(
    { id: 'demo-metal', name: 'Metal', color: 'track-3', orbit: 11, params: { gain: 0.6 } },
    `stack(
  s("metal").n("<0 2 1 2>*4").struct("x ~ x ~ ~ x ~ x x ~ ~ x ~ x ~ x")
    .crush(5).room(0.4).postgain(0.6),
  s("static").chop(8).degradeBy(0.5).postgain(0.15)
)`,
  )
  return {
    ...createProject('demo', now),
    transport: { bpm: 155, beatsPerCycle: 4 },
    tracks: [kick, perc, reese, pads, lead, theme, acidLine, screech, build, impact, metal],
    scenes: scenesOf('demo', D_SONG),
    arrangement: sectionsOf('demo', D_SONG),
    automations: [
      {
        id: 'demo-automation-pads',
        target: { trackId: 'demo-pads', param: 'lpf' },
        points: [
          { cycle: 0, value: 300 },
          { cycle: 8, value: 1300 },
          { cycle: 104, value: 1300 },
          { cycle: 112, value: 300 },
        ],
      },
      {
        id: 'demo-automation-hpf',
        target: { trackId: 'master', param: 'hpf' },
        points: [
          { cycle: 0, value: 20 },
          { cycle: 8, value: 20 },
          { cycle: 15, value: 600 },
          { cycle: 16, value: 20 },
          { cycle: 48, value: 20 },
          { cycle: 55, value: 700 },
          { cycle: 56, value: 20 },
        ],
      },
    ],
    master: { ...MASTER, gain: 0.8 },
  }
}
