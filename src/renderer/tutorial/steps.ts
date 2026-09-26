// The tutorial (welcome banner): build the tek track of tracks.ts step by step. Each step says
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
  tutorialArrangement,
  tutorialAutomations,
  tutorialBass,
  tutorialChords,
  tutorialFx,
  tutorialHats,
  tutorialIndus,
  tutorialKick,
  tutorialLead,
  tutorialRage,
  tutorialScenes,
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
      'In the sound browser, find "tek" (the distorted free-party kick) and drag it onto the new track, or click Use.',
      'Click steps 1, 5, 9 and 13 of the tek row: four on the floor.',
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
      'Add a second rhythm track. Give it an "oh" row on steps 3, 7, 11 and 15: the offbeat that makes it roll.',
      'Add a "cp" row on steps 5 and 13, and "hh" on every other step if you want more drive.',
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
      'Turn it to about 0.3: the kick gets harder and louder without getting longer.',
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
    title: 'A rolling psytrance bass',
    instructions: [
      'Add a Notes track and choose "sawtooth" as its sound.',
      'Open the Piano roll: draw F1 on the three 16ths after each kick (steps 2-4, 6-8, 10-12, 14-16). The kick and the bass never play together, that is the psytrance roll.',
      'Set Filter to about 650 and Saturation to about 0.35 in the inspector.',
    ],
    code: 'note("~ f1 f1 f1 ~ f1 f1 f1 ...").s("sawtooth").lpf(650).shape(0.35)',
    done: (p) =>
      tracksOf(p, 'notes').some(
        (t) => t.source.type === 'synth' && t.source.name === 'sawtooth' && (t.notes?.notes.length ?? 0) >= 8,
      ),
    apply: putTrack(tutorialBass()),
  },
  {
    id: 'acid',
    screen: 'pianoroll',
    title: 'An acid line',
    instructions: [
      'Add another Notes track with "sawtooth": sixteen 16th notes around F2, with jumps to F3, A flat, C and E flat.',
      'In the inspector, turn Resonance up to 18: that squelch is acid.',
    ],
    code: 'note("f2 f2 <f3 ab3> f2 ab2 f2 c3 f2 ...").s("sawtooth").lpq(18)',
    done: (p) => (acidTrack(p)?.notes?.notes.length ?? 0) >= 8,
    apply: putTrack(tutorialAcid()),
  },
  {
    id: 'animate',
    screen: 'modulation',
    title: 'Let the acid filter breathe',
    instructions: [
      'Right-click the Filter knob of the acid track and choose Animate.',
      'Pick Sine, set low to 300 Hz, high to 3200 Hz and the length to 8 cycles.',
    ],
    code: '.lpf(sine.range(300, 3200).slow(8))',
    done: (p) => typeof acidTrack(p)?.params.lpf === 'object',
    apply: (project) => {
      const acid = acidTrack(project)
      if (acid) {
        const draft = project.tracks.find((t) => t.id === acid.id)
        if (draft) draft.params.lpf = { ...ACID_SWEEP }
      }
    },
  },
  {
    id: 'melody',
    screen: 'pianoroll',
    title: 'The melodic part',
    instructions: [
      'Add a Notes track with the "pluck" instrument and draw an arpeggio: C5, A flat 4, F4, A flat 4...',
      'In the piano roll, "+ Add variant" gives each note another pitch on the next cycle: F minor, then D flat, E flat and C.',
      'Add some Reverb and Delay. The tutorial also adds long sawtooth chords under it.',
    ],
    code: 'note("<c5 db5 eb5 e5> <ab4 ab4 bb4 c5> ...").s("pluck").room(0.45).delay(0.35)',
    done: (p) =>
      tracksOf(p, 'notes').some(
        (t) => t.source.type === 'sample' && t.source.name === 'pluck' && (t.notes?.notes.length ?? 0) >= 4,
      ),
    apply: (project) => {
      putTrack(tutorialChords())(project)
      putTrack(tutorialLead())(project)
    },
  },
  {
    id: 'rage',
    screen: 'code',
    title: 'The angry part, in code',
    instructions: [
      'Add a Free code track and write a screech: a sawtooth through a vowel filter, distorted and high-passed.',
      'Try: note("<f3 f3 ab3 gb3>*8").s("sawtooth").vowel("<a e o i>").distort(3).hpf(500)',
      'Press Ctrl+Enter to hear it. Anything Strudel can do works here.',
    ],
    code: 'note("<f3 f3 ab3 gb3>*8").s("sawtooth").vowel("<a e o i>").distort(3)',
    done: (p) => codeContains(p, ['vowel', 'distort']),
    apply: putTrack(tutorialRage()),
  },
  {
    id: 'indus',
    screen: 'code',
    title: 'The industrial ending',
    instructions: [
      'Add one more Free code track: a broken industrial kick (tek:2), metal hits and crackling static, stacked.',
      's("metal").n("<0 1 2 1>*4") picks the three metal hits in turn; crush(6) makes them dirtier.',
      'The tutorial also adds an FX track with an impact and a riser for the build-ups.',
    ],
    code: 'stack(s("tek:2").struct("x ~ ~ x ..."), s("metal").n("<0 1 2 1>*4").crush(6), s("static").chop(16))',
    done: (p) => codeContains(p, ['metal']),
    apply: (project) => {
      putTrack(tutorialIndus())(project)
      putTrack(tutorialFx())(project)
    },
  },
  {
    id: 'song',
    screen: 'arrangement',
    title: 'Arrange the song',
    instructions: [
      'Each scene is a set of tracks: Intro (kick and hats), Build, Acid drop, Melodic, Drop, Rampage, Industrial, Outro.',
      'Capture scenes with "+ Capture current state" (mute tracks first), then drag them onto the timeline.',
      '"Do it for me" builds the whole song, opens the master filter over the intro and turns the compressor and limiter on.',
    ],
    code: '$: arrange([8, intro], [8, build], [16, acid_drop], [8, melodic], ...)',
    done: (p) => p.arrangement.length >= 4 && p.scenes.length >= 4,
    apply: (project) => {
      const byName = new Map(project.tracks.map((t) => [t.name.toLowerCase(), t.id]))
      const idOf = (tutorialId: string) => {
        const name = project.tracks.find((t) => t.id === tutorialId)?.name ?? tutorialId.replace('tut-', '')
        return byName.get(name.toLowerCase()) ?? tutorialId
      }
      project.scenes = tutorialScenes().map((scene) => ({
        ...scene,
        activeTrackIds: scene.activeTrackIds.map(idOf).filter((id) => project.tracks.some((t) => t.id === id)),
      }))
      project.arrangement = tutorialArrangement()
      project.automations = tutorialAutomations()
      project.master = { ...TUTORIAL_MASTER }
    },
  },
]

/** The tutorial track, finished: every step applied to a fresh project. */
export function applyAllSteps(project: Draft<Project>): void {
  for (const step of TUTORIAL_STEPS) step.apply(project)
}
