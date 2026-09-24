import { mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDemoProject } from '../renderer/model/demo'
import { createProject, createTransform } from '../renderer/model/defaults'
import { migrateProject, serializeProject } from '../renderer/model/migrations'
import {
  assertProjectText,
  containsFreeCode,
  MAX_PROJECT_BYTES,
  projectNameFromDir,
  readProjectFolder,
  withProjectExtension,
  writeProjectFolder,
} from './project-files'
import { Recovery } from './recovery'
import { TrustedProjects } from './trusted-projects'

let base: string
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'motif-project-'))
})
afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('project folders', () => {
  it('save then reopen yields an identical project', async () => {
    const project = createDemoProject(new Date(0))
    project.tracks[0]?.transforms.push(createTransform('fast', () => 'fast-1'))
    const dir = join(base, 'My song.motif')

    await writeProjectFolder(dir, serializeProject(project))
    const reopened = migrateProject(JSON.parse(await readProjectFolder(dir)))

    expect(reopened).toEqual(project)
    expect(readdirSync(dir).sort()).toEqual(['project.json', 'samples'])
    expect((await stat(join(dir, 'samples'))).isDirectory()).toBe(true)
  })

  it('overwrites an existing project without leaving temporary files', async () => {
    const dir = join(base, 'Song.motif')
    await writeProjectFolder(dir, serializeProject(createProject('A')))
    await writeProjectFolder(dir, serializeProject(createProject('B')))
    expect(JSON.parse(await readFile(join(dir, 'project.json'), 'utf8'))).toMatchObject({ meta: { name: 'B' } })
    expect(readdirSync(dir).sort()).toEqual(['project.json', 'samples'])
  })

  it('only writes and reads folders ending with .motif', async () => {
    await expect(writeProjectFolder(join(base, 'Song'), '{}')).rejects.toThrow('.motif')
    await expect(readProjectFolder(join(base, 'Song'))).rejects.toThrow('.motif')
    await expect(readProjectFolder(join(base, 'Empty.motif'))).rejects.toThrow('no project.json')
  })

  it('refuses oversized or non-text data', async () => {
    expect(() => {
      assertProjectText(42)
    }).toThrow('text')
    expect(() => {
      assertProjectText('x'.repeat(MAX_PROJECT_BYTES + 1))
    }).toThrow('too large')
    const dir = join(base, 'Huge.motif')
    await mkdir(dir)
    await writeFile(join(dir, 'project.json'), Buffer.alloc(MAX_PROJECT_BYTES + 1))
    await expect(readProjectFolder(dir)).rejects.toThrow('too large')
  })

  it('names folders', () => {
    expect(withProjectExtension('/music/Song')).toBe('/music/Song.motif')
    expect(withProjectExtension('/music/Song.MOTIF')).toBe('/music/Song.MOTIF')
    expect(projectNameFromDir('/music/My song.motif')).toBe('My song')
  })
})

describe('containsFreeCode', () => {
  it('detects free code tracks and custom transforms', () => {
    expect(containsFreeCode(serializeProject(createDemoProject()))).toBe(true)
    const noCode = createDemoProject()
    noCode.tracks = noCode.tracks.filter((t) => t.kind !== 'code')
    expect(containsFreeCode(serializeProject(noCode))).toBe(false)
    noCode.tracks[0]?.transforms.push(createTransform('custom'))
    expect(containsFreeCode(serializeProject(noCode))).toBe(true)
  })

  it('treats malformed data as having no free code (loading will reject it anyway)', () => {
    expect(containsFreeCode('not json')).toBe(false)
    expect(containsFreeCode('{"tracks": 3}')).toBe(false)
    expect(containsFreeCode('{"tracks": [null, {"transforms": [null]}]}')).toBe(false)
  })
})

describe('Recovery', () => {
  it('offers the autosave only after a session that did not quit cleanly', async () => {
    const dir = join(base, 'recovery')
    const first = new Recovery(dir)
    await first.start()
    await first.write('{"autosaved":1}', '/music/Song.motif', new Date(0))
    expect(await first.read()).toBeNull()

    // The app crashed: stop() never ran.
    const second = new Recovery(dir)
    await second.start()
    expect(await second.read()).toEqual({
      text: '{"autosaved":1}',
      projectDir: '/music/Song.motif',
      savedAt: '1970-01-01T00:00:00.000Z',
    })
    await second.clear()
    expect(await second.read()).toBeNull()
    await second.stop()

    // Clean quit: nothing to recover, even if a stale file was left behind.
    const third = new Recovery(dir)
    await writeFile(join(dir, 'recovery.json'), '{"text":"old","savedAt":"x"}')
    await third.start()
    expect(await third.read()).toBeNull()
  })

  it('ignores a damaged recovery file', async () => {
    const dir = join(base, 'recovery')
    await mkdir(dir)
    await writeFile(join(dir, 'session.lock'), '1')
    await writeFile(join(dir, 'recovery.json'), '{"text": 3}')
    const recovery = new Recovery(dir)
    await recovery.start()
    expect(await recovery.read()).toBeNull()
  })
})

describe('TrustedProjects', () => {
  it('remembers folders across instances and resolves symbolic links', async () => {
    const file = join(base, 'trusted.json')
    const dir = join(base, 'Song.motif')
    await mkdir(dir)
    symlinkSync(dir, join(base, 'Link.motif'))

    const trusted = new TrustedProjects(file)
    expect(await trusted.isTrusted(dir)).toBe(false)
    await trusted.trust(dir)
    await trusted.trust(dir)
    expect(await new TrustedProjects(file).isTrusted(join(base, 'Link.motif'))).toBe(true)
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveLength(1)
  })

  it('starts empty when the file is missing or damaged', async () => {
    const file = join(base, 'trusted.json')
    await writeFile(file, '{"not": "a list"}')
    expect(await new TrustedProjects(file).isTrusted(base)).toBe(false)
  })
})

describe('RecentProjects', () => {
  it('keeps the latest 10 folders, most recent first, and resolves opaque ids', async () => {
    const { RecentProjects } = await import('./recent-projects')
    const file = join(base, 'recent.json')
    const recent = new RecentProjects(file)
    for (let i = 0; i < 12; i++) await recent.add(`/music/Song ${String(i)}.motif`)
    await recent.add('/music/Song 5.motif')
    const list = await new RecentProjects(file).list()
    expect(list).toHaveLength(10)
    expect(list[0]?.name).toBe('Song 5')
    expect(list[1]?.name).toBe('Song 11')
    expect(JSON.stringify(list)).not.toContain('/music')
    expect(await recent.resolve(list[0]?.id)).toBe('/music/Song 5.motif')
    expect(await recent.resolve('nope')).toBeNull()
    expect(await recent.resolve(42)).toBeNull()
    await recent.remove('/music/Song 5.motif')
    expect((await recent.list())[0]?.name).toBe('Song 11')
  })
})
