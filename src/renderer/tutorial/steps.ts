// The tutorial (welcome banner): build the song of tracks.ts step by step. Each step says
// what to do and which code it writes, recognizes the work when done by hand, and can do it for
// the user. Pure: checks read the project, applies are recipes for ProjectState.update.
import type { Draft } from 'immer'
import type { Project, Track } from '../model/project'
import type { Screen } from '../store/ui-store'
import type { Recipe } from '../store/project-store'
import {
  ACID_SWEEP,
  FOUR_ON_THE_FLOOR,
  TUTORIAL_BPM,
  TUTORIAL_MASTER,
  tutorialAcid,
  tutorialArp,
  tutorialArrangement,
  tutorialAutomations,
  tutorialBass,
  tutorialBuild,
  tutorialHardKick,
  tutorialHats,
  tutorialImpact,
  tutorialIndus,
  tutorialIndusHook,
  tutorialKick,
  tutorialLead,
  tutorialPads,
  tutorialRage,
  tutorialScenes,
  tutorialTheme,
} from './tracks'

export interface TutorialStep {
  id: string
  /** The screen the step happens on; "Show me" opens it. */
  screen: Screen
  title: string
  /** What to do, one instruction per line. */
  instructions: string[]
  /** The Strudel code this step makes appear. */
  code: string
  /** Whether the project already has what the step asks for. */
  done: (project: Project) => boolean
  /** "Do it for me". */
  apply: Recipe
}

/**
 * Puts a tutorial track in the project: replaces the tutorial's own version and any track of the
 * same name, keeps its orbit unless another track uses it.
 */
function putTrack(track: Track): Recipe {
  return (project) => {
    const index = project.tracks.findIndex(
      (t) => t.id === track.id || t.name.toLowerCase() === track.name.toLowerCase(),
    )
    const others = project.tracks.filter((_, i) => i !== index)
    const orbit = others.some((t) => t.orbit === track.orbit)
      ? Math.max(0, ...project.tracks.map((t) => t.orbit)) + 1
      : track.orbit
    const placed = { ...track, orbit } as Draft<Track>
    if (index >= 0) project.tracks[index] = placed
    else project.tracks.push(placed)
  }
}

const tracksOf = (project: Project, kind: Track['kind']) => project.tracks.filter((t) => t.kind === kind)

/** A rhythm track with a row of `sound` on at least these steps. */
function hasRow(project: Project, sound: string, hits: readonly number[]): boolean {
  return tracksOf(project, 'steps').some((t) =>
    t.steps?.rows.some((row) => row.sound === sound && hits.every((i) => row.steps[i] !== null)),
  )
}

const kickTrack = (project: Project) =>
  tracksOf(project, 'steps').find((t) => t.steps?.rows.some((row) => row.sound === 'tek'))

/** The acid line: the notes track with the most resonance. */
const acidTrack = (project: Project) =>
  tracksOf(project, 'notes')
    .filter((t) => typeof t.params.lpq === 'number' && t.params.lpq >= 10)
    .sort((a, b) => Number(b.params.lpq) - Number(a.params.lpq))[0]

const codeContains = (project: Project, words: readonly string[]) =>
  tracksOf(project, 'code').some((t) => words.some((word) => t.code?.includes(word)))

/** A notes track playing a sound (synth or sample) with at least `count` notes. */
const notesWith = (project: Project, sound: string, count: number) =>
  tracksOf(project, 'notes').some(
    (t) => t.source.type !== 'bank' && t.source.name === sound && (t.notes?.notes.length ?? 0) >= count,
  )

/** Chords: at least three notes starting together, and a change from one bar to the next. */
const hasChords = (project: Project) =>
  tracksOf(project, 'notes').some((t) => {
    const notes = t.notes?.notes ?? []
    const starts = new Map<number, number>()
    for (const n of notes) starts.set(n.step, (starts.get(n.step) ?? 0) + 1)
    return [...starts.values()].some((count) => count >= 3) && notes.some((n) => (n.alternatives?.length ?? 0) >= 1)
  })

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'tempo',
    screen: 'studio',
    title: 'Set the tempo to 150 BPM',
    instructions: [
      'Tek and psytrance run fast. Click the Tempo pill at the top, type 150 and press Enter.',
      'The first line of the code follows: a cycle is one bar of 4 beats.',
    ],
    code: 'setcpm(150/4)',
    done: (p) => p.transport.bpm === TUTORIAL_BPM,
    apply: (project) => {
      project.transport.bpm = TUTORIAL_BPM
    },
  },
  {
    id: 'kick',
    screen: 'studio',
    title: 'A tek kick on every beat',
    instructions: [
      'Click "+ Add track", then Rhythm.',
      'In the sound browser, find "tek" (a distorted free-party kick) and drag it onto the new track, or click Use.',
      'Click steps 1, 5, 9 and 13: four on the floor.',
    ],
    code: 's(`tek ~  ~  ~  tek ~  ~  ~  tek ~  ~  ~  tek ~  ~  ~ `)',
    done: (p) => hasRow(p, 'tek', FOUR_ON_THE_FLOOR),
    apply: putTrack(tutorialKick()),
  },
  {
    id: 'hats',
    screen: 'studio',
    title: 'Open hats between the kicks, claps on 2 and 4',
    instructions: [
      'Add a second rhythm track with an "oh" row on steps 3, 7, 11 and 15: the offbeat that makes it roll.',
      'Add a "cp" row on steps 5 and 13, and "hh" on the even steps for drive.',
    ],
    code: 's(`~  ~  oh ~  ~  ~  oh ~ ..., ~  ~  ~  ~  cp ~ ...`)',
    done: (p) =>
      hasRow(p, 'oh', [2, 6, 10, 14]) && tracksOf(p, 'steps').some((t) => t.steps?.rows.some((r) => r.sound === 'cp')),
    apply: putTrack(tutorialHats()),
  },
  {
    id: 'saturation',
    screen: 'mixer',
    title: 'Make the kick fat',
    instructions: [
      'Open the Mixer. On the kick strip, click "+ Add effect" and choose Saturation.',
      'Turn it to about 0.3: the kick gets harder without getting longer.',
    ],
    code: '.shape(0.3)',
    done: (p) => {
      const shape = kickTrack(p)?.params.shape
      return typeof shape === 'number' && shape >= 0.2
    },
    apply: (project) => {
      const kick = project.tracks.find((t) => t.kind === 'steps' && t.steps?.rows.some((r) => r.sound === 'tek'))
      if (kick) kick.params.shape = 0.3
    },
  },
  {
    id: 'bass',
    screen: 'pianoroll',
    title: 'A rolling bass that follows the chords',
    instructions: [
      'The song turns around 8 chords, one per bar: F minor, D flat, A flat, E flat, F minor, D flat, B flat minor, C.',
      'Add a Notes track with "sawtooth". In the piano roll, draw F1 on the three 16ths after each kick (steps 2-4, 6-8, 10-12, 14-16): the psytrance roll.',
      'Then use "Edit cycle": on Cycle 2 move the notes to D flat, on Cycle 3 to A flat, and so on. Each note plays one pitch per bar.',
    ],
    code: 'note("~ <f1 db1 ab1 eb1 f1 db1 bb1 c2> ...").s("sawtooth").lpf(650).shape(0.35)',
    done: (p) => notesWith(p, 'sawtooth', 8),
    apply: putTrack(tutorialBass()),
  },
  {
    id: 'pads',
    screen: 'pianoroll',
    title: 'The chords',
    instructions: [
      'Add a Notes track with "sawtooth" and draw a chord that lasts the whole bar: F2, F3, A flat 3, C4.',
      'With "Edit cycle", give each bar its chord, moving the voices as little as possible: F3, A flat 3 and D flat 4 over D flat...',
      'A slow attack, Reverb and a low Filter turn it into a pad.',
    ],
    code: 'note("<[f2,f3,ab3,c4] [db2,f3,ab3,db4] ...>").s("sawtooth").attack(0.5).room(0.7)',
    done: hasChords,
    apply: putTrack(tutorialPads()),
  },
  {
    id: 'lead',
    screen: 'pianoroll',
    title: 'The hook',
    instructions: [
      'Add a Notes track with "supersaw": the big trance lead.',
      'Each bar asks a question and answers it: C5 C5 A flat 4 C5, then up to F5 and back down. Over the C chord, use E natural: it pulls back to F.',
      'Delay and a touch of Saturation make it wide and bright.',
    ],
    code: 'note("<[c5 ~ c5 ab4 ~ c5 ~ f5 ~ eb5 ...] ...>").s("supersaw")',
    done: (p) => notesWith(p, 'supersaw', 6),
    apply: putTrack(tutorialLead()),
  },
  {
    id: 'theme',
    screen: 'pianoroll',
    title: 'A slow theme for the breakdown',
    instructions: [
      'Add a Notes track with the "epiano" instrument: three notes per bar, a long one, a short one, a long landing on a chord tone.',
      'F5, E flat 5, C5 over F minor; D flat 5, C5, A flat 4 over D flat...',
    ],
    code: 'note("<[f5@6 eb5@2 c5@8] [db5@6 c5@2 ab4@8] ...>").s("epiano")',
    done: (p) => notesWith(p, 'epiano', 3),
    apply: putTrack(tutorialTheme()),
  },
  {
    id: 'acid',
    screen: 'pianoroll',
    title: 'An acid line on each chord',
    instructions: [
      'Add a Notes track with "sawtooth": sixteen 16th notes on the root, with octave jumps and the flat second (phrygian).',
      "Move it to each bar's root like the bass. Then turn Resonance up to 18: that squelch is acid.",
    ],
    code: 'note("<[f2 f2 f3 f2 ab2 ...] [db2 db2 db3 ...] ...>").s("sawtooth").lpq(18)',
    done: (p) => (acidTrack(p)?.notes?.notes.length ?? 0) >= 8,
    apply: putTrack(tutorialAcid()),
  },
  {
    id: 'animate',
    screen: 'modulation',
    title: 'Let the acid filter breathe',
    instructions: [
      'Right-click the Filter knob of the acid track and choose Animate.',
      'Pick Sine, low 300 Hz, high 3500 Hz, 16 cycles: the filter opens over a whole acid section.',
    ],
    code: '.lpf(sine.range(300, 3500).slow(16))',
    done: (p) => typeof acidTrack(p)?.params.lpf === 'object',
    apply: (project) => {
      const found = acidTrack(project)
      const draft = found && project.tracks.find((t) => t.id === found.id)
      if (draft) draft.params.lpf = { ...ACID_SWEEP }
    },
  },
  {
    id: 'arp',
    screen: 'code',
    title: 'An arpeggio, in code',
    instructions: [
      'Add a Free code track. Write the chords as stacks and let arp play them note by note:',
      'note("<[f4,ab4,c5] [f4,ab4,db5] ...>").arp("0 1 2 1 0 2 1 2").s("pluck")',
      'Ctrl+Enter plays it. Code and interface write the same Strudel.',
    ],
    code: 'note("<[f4,ab4,c5] ...>").arp("0 1 2 1 0 2 1 2 ...").s("pluck")',
    done: (p) => codeContains(p, ['arp(']),
    apply: putTrack(tutorialArp()),
  },
  {
    id: 'build',
    screen: 'code',
    title: 'Build-ups and drops',
    instructions: [
      'A snare roll that doubles every bar, sd*4, sd*8, sd*16, sd*32, and a riser, over the last bars of a build.',
      'An impact and a crash on the first beat of each drop.',
    ],
    code: 's("<~ ~ ~ ~ sd*4 sd*8 sd*16 sd*32>"), s("<[impact, cr] ~ ~ ~ ~ ~ ~ ~>")',
    done: (p) => codeContains(p, ['riser']),
    apply: (project) => {
      putTrack(tutorialBuild())(project)
      putTrack(tutorialImpact())(project)
    },
  },
  {
    id: 'rage',
    screen: 'code',
    title: 'The angry part',
    instructions: [
      'A screech riff on the chord roots: octaves and fifths added with add(), through a vowel filter, distorted.',
      'note("<f3 db3 ab3 eb3 f3 db3 bb3 c4>".add("0 12 0 7 0 12 7 12")).s("sawtooth").vowel("<a e o i>/2").distort(3)',
    ],
    code: 'note("<f3 db3 ...>".add("0 12 0 7 ...")).s("sawtooth").vowel("<a e o i>/2").distort(3)',
    done: (p) => codeContains(p, ['vowel']),
    apply: putTrack(tutorialRage()),
  },
  {
    id: 'finale',
    screen: 'code',
    title: 'The industrial finale',
    instructions: [
      'A harder kick (tek:1), metal hits, crackling static and a broken industrial kick (tek:2).',
      'And the hook comes back: the same notes on a square wave, distorted and crushed. Melodic, saturated.',
    ],
    code: 's("metal").n("<0 1 2 1>*4").crush(6), note("<[c5 ~ c5 ab4 ...]>").s("square").distort(2).crush(8)',
    done: (p) => codeContains(p, ['metal']),
    apply: (project) => {
      putTrack(tutorialHardKick())(project)
      putTrack(tutorialIndus())(project)
      putTrack(tutorialIndusHook())(project)
    },
  },
  {
    id: 'song',
    screen: 'arrangement',
    title: 'Arrange the song',
    instructions: [
      'Intro, Build, Drop, Acid solo, Breakdown, Build 2, Drop 2, Rampage, Finale, Outro: each scene is a set of tracks.',
      'Capture scenes with "+ Capture current state" (mute tracks first), then drag them onto the timeline.',
      '"Do it for me" builds the whole song, about 3 minutes 40, with the pads opening over the intro and the builds high-passed.',
    ],
    code: '$: arrange([16, intro], [8, build], [16, drop], [16, acid_solo], ...)',
    done: (p) => p.arrangement.length >= 6 && p.scenes.length >= 6,
    apply: (project) => {
      const byName = new Map(project.tracks.map((t) => [t.name.toLowerCase(), t.id]))
      const nameOf = new Map(
        [
          tutorialKick(),
          tutorialHats(),
          tutorialBass(),
          tutorialPads(),
          tutorialLead(),
          tutorialTheme(),
          tutorialAcid(),
          tutorialArp(),
          tutorialBuild(),
          tutorialImpact(),
          tutorialRage(),
          tutorialHardKick(),
          tutorialIndus(),
          tutorialIndusHook(),
        ].map((t) => [t.id, t.name.toLowerCase()]),
      )
      const idOf = (tutorialId: string) => byName.get(nameOf.get(tutorialId) ?? '') ?? tutorialId
      project.scenes = tutorialScenes().map((scene) => ({
        ...scene,
        activeTrackIds: scene.activeTrackIds.map(idOf).filter((id) => project.tracks.some((t) => t.id === id)),
      }))
      project.arrangement = tutorialArrangement()
      project.automations = tutorialAutomations().map((a) => ({
        ...a,
        target: { ...a.target, trackId: a.target.trackId === 'master' ? 'master' : idOf(a.target.trackId) },
      }))
      project.master = { ...TUTORIAL_MASTER }
    },
  },
]
