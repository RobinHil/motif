import { describe, expect, it } from 'vitest'
import catalog from '../../../resources/samples/motif-kit/catalog.json'
import { generateProjectCode } from '../codegen/generate'
import { generateSongCode, songLength, songSections } from '../codegen/song'
import { playedEvents } from '../codegen/strudel-harness'
import { ProjectSchema, type Project } from '../model/project'
import { createStarterDemo, createTutorialTrack } from './tracks'

const bundled = new Set([...catalog.sounds.map((s) => s.name), 'sawtooth', 'square', 'triangle', 'sine'])

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
    const events = await playedEvents(generateProjectCode(project).code, 0, 4)
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
  it('lasts about two minutes and a quarter at 150 BPM', () => {
    const project = createTutorialTrack(new Date(0))
    const seconds = (songLength(project) * 60 * project.transport.beatsPerCycle) / project.transport.bpm
    expect(Math.round(seconds)).toBe(134)
    expect(project.scenes.map((s) => s.name)).toEqual([
      'Intro',
      'Build',
      'Acid drop',
      'Melodic',
      'Drop',
      'Rampage',
      'Industrial',
      'Outro',
    ])
  })
})
