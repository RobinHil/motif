import { describe, expect, it } from 'vitest'
import { createDemoProject } from './demo'
import { createProject, createTrack, createTransform, nextColor, nextOrbit } from './defaults'
import { ProjectSchema, TRANSFORM_TYPES, type Project, type Track } from './project'

const valid = (project: Project) => ProjectSchema.safeParse(project).success

function withTracks(tracks: Track[]): Project {
  return { ...createProject('Test', new Date(0)), tracks }
}

describe('ProjectSchema', () => {
  it('accepts the demo project and new tracks of every kind', () => {
    expect(valid(createDemoProject())).toBe(true)
    const tracks: Track[] = []
    for (const kind of ['steps', 'notes', 'code'] as const) tracks.push(createTrack(kind, tracks))
    expect(valid(withTracks(tracks))).toBe(true)
  })

  it('rejects a sound name that could escape a mini-notation string', () => {
    const track = createTrack('steps', [])
    const row = track.steps?.rows[0]
    if (!row) throw new Error('expected a row')
    row.sound = 'bd`).evil(//'
    expect(valid(withTracks([track]))).toBe(false)
  })

  it('rejects two tracks on the same orbit and duplicate ids', () => {
    const a = createTrack('code', [])
    expect(valid(withTracks([a, { ...createTrack('code', []), id: 'other' }]))).toBe(false)
    expect(valid(withTracks([a, { ...a, orbit: 9 }]))).toBe(false)
  })

  it('rejects a track without the content of its kind', () => {
    const { steps: _steps, ...track } = createTrack('steps', [])
    expect(valid(withTracks([track as Track]))).toBe(false)
  })

  it('requires a scale in degree mode and keeps notes inside the cycle', () => {
    const track = createTrack('notes', [])
    const notes = { mode: 'degree' as const, stepsPerCycle: 16 as const, notes: [] }
    expect(valid(withTracks([{ ...track, notes }]))).toBe(false)
    expect(valid(withTracks([{ ...track, notes: { ...notes, scale: 'C:minor' } }]))).toBe(true)
    const late = { id: 'n', step: 15, length: 2, pitch: 'c3', velocity: 1, probability: 1 }
    expect(valid(withTracks([{ ...track, notes: { ...notes, scale: 'C:minor', notes: [late] } }]))).toBe(false)
  })

  it('rejects non-finite numbers', () => {
    const track = createTrack('code', [])
    expect(valid(withTracks([{ ...track, params: { gain: Number.POSITIVE_INFINITY, pan: 0.5 } }]))).toBe(false)
  })
})

describe('defaults', () => {
  it('assigns the first free orbit and cycles colors', () => {
    const tracks: Track[] = []
    for (let i = 0; i < 5; i++) tracks.push(createTrack('code', tracks))
    expect(tracks.map((t) => t.orbit)).toEqual([1, 2, 3, 4, 5])
    expect(tracks.map((t) => t.color)).toEqual(['track-1', 'track-2', 'track-3', 'track-4', 'track-1'])
    expect(nextOrbit(tracks.filter((t) => t.orbit !== 2))).toBe(2)
    expect(nextColor([])).toBe('track-1')
  })

  it('creates every transform with its default arguments', () => {
    for (const type of TRANSFORM_TYPES) {
      const transform = createTransform(type, () => 'id')
      expect(transform).toMatchObject({ id: 'id', type, enabled: true })
    }
    expect(createTransform('lastOf').args).toEqual({ every: 4, factor: 2 })
  })

  it('returns independent copies of the demo project', () => {
    const a = createDemoProject()
    const b = createDemoProject()
    a.tracks[0]?.transforms.push(createTransform('rev'))
    expect(b.tracks[0]?.transforms).toEqual([])
  })
})
