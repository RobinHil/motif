import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createDemoProject } from './demo'
import { migrateProject, ProjectLoadError, serializeProject } from './migrations'

describe('migrateProject', () => {
  it('accepts a current project and returns an equal one', () => {
    const demo = createDemoProject(new Date(0))
    expect(migrateProject(JSON.parse(serializeProject(demo)))).toEqual(demo)
  })

  it('rejects things that are not projects', () => {
    for (const raw of [null, 3, 'x', [], {}, { version: '1' }, { version: 0 }, { version: 1.5 }]) {
      expect(() => migrateProject(raw)).toThrow(ProjectLoadError)
    }
  })

  it('rejects projects from a newer version', () => {
    expect(() => migrateProject({ ...createDemoProject(), version: 2 })).toThrow('newer version of Motif')
  })

  it('reports where a damaged project is wrong', () => {
    const demo = createDemoProject()
    const broken = { ...demo, transport: { bpm: 'fast', beatsPerCycle: 4 } }
    expect(() => migrateProject(broken)).toThrow('transport.bpm')
  })

  it('runs migrations in order up to the current version', () => {
    const schema = z.object({ version: z.literal(3), title: z.string(), tags: z.array(z.string()) })
    const migrations = {
      1: (p: Record<string, unknown>) => ({ ...p, title: p['name'] }),
      2: (p: Record<string, unknown>) => ({ version: p['version'], title: p['title'], tags: [] }),
    }
    const result = migrateProject({ version: 1, name: 'Old song' }, { migrations, currentVersion: 3, schema })
    expect(result).toEqual({ version: 3, title: 'Old song', tags: [] })
  })

  it('stops when a migration is missing', () => {
    const schema = z.object({ version: z.literal(3) })
    expect(() => migrateProject({ version: 1 }, { migrations: {}, currentVersion: 3, schema })).toThrow(
      'No migration from project format 1',
    )
  })
})

describe('serializeProject', () => {
  it('is stable across a load', () => {
    const text = serializeProject(createDemoProject(new Date(0)))
    expect(serializeProject(migrateProject(JSON.parse(text)))).toBe(text)
    expect(text.endsWith('}\n')).toBe(true)
  })
})
