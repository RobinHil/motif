import { describe, expect, it } from 'vitest'
import catalog from '../../../resources/samples/motif-kit/catalog.json'
import { generateProjectCode } from '../codegen/generate'
import { generateSongCode, songLength, songSections } from '../codegen/song'
import { playedEvents } from '../codegen/strudel-harness'
import { ProjectSchema, type Project } from '../model/project'
import { createStarterDemo, createTutorialTrack } from './tracks'

const bundled = new Set([...catalog.sounds.map((s) => s.name), 'sawtooth', 'square', 'triangle', 'sine', 'supersaw'])

/** Orbits sounding between two cycles of the song. */
async function orbitsAt(code: string, begin: number, end: number): Promise<number[]> {
  const events = await playedEvents(code, begin, end)
  return [...new Set(events.map((e) => Number(e.value['orbit'])))].sort((a, b) => a - b)
}

describe.each([
  ['the tutorial track', createTutorialTrack],
  ['the starter demo', createStarterDemo],
] as const)('%s', (_name, create) => {
  const project: Project = create(new Date(0))

  it('is a valid project', () => {
    expect(ProjectSchema.safeParse(project).success).toBe(true)
  })

  it('plays every track in the loop with bundled sounds only', async () => {
    const events = await playedEvents(generateProjectCode(project).code, 0, 8)
    expect(new Set(events.map((e) => e.value['orbit']))).toEqual(new Set(project.tracks.map((t) => t.orbit)))
    for (const event of events) {
      const sound = String(event.value['s'])
      expect(bundled.has(sound.replace(/^MotifKit_/, '')), sound).toBe(true)
    }
  })

  it('plays each section of its song with the tracks of its scene', async () => {
    const { code } = generateSongCode(project)
    for (const section of songSections(project)) {
      const scene = project.scenes.find((s) => s.id === section.sceneId)
      const expected = project.tracks
        .filter((t) => scene?.activeTrackIds.includes(t.id))
        .map((t) => t.orbit)
        .sort((a, b) => a - b)
      // Over the whole section: effects like the riser only play on some of its cycles.
      expect(await orbitsAt(code, section.start, section.start + section.length), scene?.name).toEqual(expected)
    }
    expect(songLength(project)).toBeGreaterThan(30)
  })
})

describe('the tutorial track', () => {
  it('is a whole song: about three minutes forty at 150 BPM, ten sections', () => {
    const project = createTutorialTrack(new Date(0))
    const seconds = (songLength(project) * 60 * project.transport.beatsPerCycle) / project.transport.bpm
    expect(Math.round(seconds)).toBe(218)
    expect(project.scenes.map((s) => s.name)).toEqual([
      'Intro',
      'Build',
      'Drop',
      'Acid solo',
      'Breakdown',
      'Build 2',
      'Drop 2',
      'Rampage',
      'Finale',
      'Outro',
    ])
  })

  it('follows its chord progression: the bass plays each root in turn', async () => {
    const project = createTutorialTrack(new Date(0))
    const bass = project.tracks.find((t) => t.name === 'Bass')
    if (!bass) throw new Error('bass')
    const events = await playedEvents(generateProjectCode({ ...project, tracks: [bass] }).code, 0, 8)
    const firstOfBar = (bar: number) => events.find((e) => e.begin >= bar && e.begin < bar + 1)?.value['note']
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(firstOfBar)).toEqual(['f1', 'db1', 'ab1', 'eb1', 'f1', 'db1', 'bb1', 'c2'])
  })
})
