import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isLibraryFile, projectSampleEntries, SampleLibrary } from './sample-library'

let base: string
let library: SampleLibrary

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'motif-library-'))
  library = new SampleLibrary(join(base, 'library'), new Set(['bd', 'sine']))
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

function folder(name: string, files: string[]): string {
  const dir = join(base, 'source', name)
  mkdirSync(dir, { recursive: true })
  for (const file of files) writeFileSync(join(dir, file), `data of ${file}`)
  return dir
}

describe('SampleLibrary', () => {
  it('turns a folder of 20 WAV files into one sound with 20 variants, in natural order', async () => {
    const files = Array.from({ length: 20 }, (_, i) => `Hit ${String(i + 1)}.wav`)
    const dir = folder('Glass Hits', files)
    const result = await library.import([dir])
    expect(result.rejected).toEqual([])
    expect(result.added).toHaveLength(1)
    const [sound] = result.added
    expect(sound?.name).toBe('glass_hits')
    expect(sound?.files).toHaveLength(20)
    expect(sound?.files[0]).toBe('glass_hits/0.wav')
    expect(readFileSync(join(library.root, 'glass_hits', '1.wav'), 'utf8')).toBe('data of Hit 2.wav')
    expect(readFileSync(join(library.root, 'glass_hits', '9.wav'), 'utf8')).toBe('data of Hit 10.wav')
    expect(sound?.sources[1]).toBe('Hit 2.wav')
    expect(await new SampleLibrary(library.root, new Set()).list()).toEqual([
      { name: 'glass_hits', files: sound?.files, folder: 'Glass Hits' },
    ])
  })

  it('rejects other formats by name, and avoids taken names', async () => {
    const dir = folder('BD', ['kick.wav', 'readme.txt', 'pad.aiff', '.DS_Store'])
    const loose = join(folder('loose', ['Snare Roll.flac']), 'Snare Roll.flac')
    const result = await library.import([dir, loose, join(base, 'missing.wav')])
    expect(result.added.map((s) => s.name)).toEqual(['bd_2', 'snare_roll'])
    expect(result.added[1]?.folder).toBe('loose')
    expect(result.rejected).toEqual([
      { file: 'pad.aiff', reason: 'not an audio format Motif can read' },
      { file: 'readme.txt', reason: 'not an audio format Motif can read' },
      { file: 'missing.wav', reason: 'not found' },
    ])
  })

  it('makes one sound per subfolder', async () => {
    const dir = folder('Pack', ['top.wav'])
    mkdirSync(join(dir, 'Toms'))
    writeFileSync(join(dir, 'Toms', 'lo.wav'), 'x')
    const { added } = await library.import([dir])
    expect(added.map((s) => [s.name, s.folder, s.files.length])).toEqual([
      ['toms', 'Pack', 1],
      ['pack', 'Pack', 1],
    ])
  })

  it('removes files that could not be decoded', async () => {
    const { added } = await library.import([folder('Pair', ['a.wav', 'b.wav'])])
    await library.removeFiles('pair', ['pair/0.wav'])
    expect((await library.list())[0]?.files).toEqual(['pair/1.wav'])
    await library.removeFiles('pair', ['pair/1.wav'])
    expect(await library.list()).toEqual([])
    expect(existsSync(join(library.root, 'pair'))).toBe(false)
    expect(added).toHaveLength(1)
  })

  it('copies used samples into a project, from the library or from the previous project folder', async () => {
    const { added } = await library.import([folder('Vox', ['one.wav'])])
    const previous = join(base, 'old.motif', 'samples')
    mkdirSync(join(previous, 'elsewhere'), { recursive: true })
    writeFileSync(join(previous, 'elsewhere', '0.wav'), 'old')
    const samples = join(base, 'new.motif', 'samples')
    const missing = await library.copyToProject(
      [
        ...added,
        { name: 'elsewhere', files: ['elsewhere/0.wav'], folder: '' },
        { name: 'gone', files: ['gone/0.wav'], folder: '' },
      ],
      samples,
      previous,
    )
    expect(readFileSync(join(samples, 'vox', '0.wav'), 'utf8')).toBe('data of one.wav')
    expect(readFileSync(join(samples, 'elsewhere', '0.wav'), 'utf8')).toBe('old')
    expect(missing).toEqual(['gone/0.wav'])
  })

  it('only accepts library-shaped paths from project files', () => {
    expect(isLibraryFile('vox/0.wav')).toBe(true)
    expect(isLibraryFile('../vox/0.wav')).toBe(false)
    expect(isLibraryFile('vox/../../x.wav')).toBe(false)
    expect(isLibraryFile('/etc/passwd')).toBe(false)
    const text = JSON.stringify({
      sampleLibrary: [
        { name: 'vox', files: ['vox/0.wav', '../escape.wav'], origin: 'user' },
        { name: 'bd', files: ['bd/0.wav'], origin: 'bundled' },
      ],
    })
    expect(projectSampleEntries(text)).toEqual([{ name: 'vox', files: ['vox/0.wav'], folder: '' }])
    expect(projectSampleEntries('not json')).toEqual([])
  })
})
