import { describe, expect, it } from 'vitest'
import { createDemoProject } from './demo'
import { projectSampleLibrary, usedSoundNames } from './samples'

describe('imported samples of a project', () => {
  it('finds sounds in sources, step rows and free code', () => {
    const project = createDemoProject()
    const names = usedSoundNames(project)
    expect(names.has('bd')).toBe(true)
    expect(names.has('wind')).toBe(true)
    expect(names.has('triangle')).toBe(true)
  })

  it('keeps only the imported sounds the project plays', () => {
    const project = createDemoProject()
    const drums = project.tracks.find((t) => t.kind === 'steps')
    const row = drums?.steps?.rows[0]
    if (!row) throw new Error('demo has a drum row')
    row.sound = 'glass_hits'
    const library = [
      { name: 'glass_hits', files: ['glass_hits/0.wav', 'glass_hits/1.wav'], folder: 'Glass Hits' },
      { name: 'unused', files: ['unused/0.wav'], folder: 'Other' },
    ]
    expect(projectSampleLibrary(project, library)).toEqual([
      { name: 'glass_hits', files: ['glass_hits/0.wav', 'glass_hits/1.wav'], origin: 'user', folder: 'Glass Hits' },
    ])
  })
})
