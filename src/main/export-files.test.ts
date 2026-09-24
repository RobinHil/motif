import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { safeFileName, validExportFiles, writeExportFiles } from './export-files'

const dir = mkdtempSync(join(tmpdir(), 'motif-export-'))
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

const buffer = (text: string) => new TextEncoder().encode(text).buffer

describe('export files', () => {
  it('keeps file names as names, never paths', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd')
    expect(safeFileName('Song - Drums.wav')).toBe('Song - Drums.wav')
    expect(safeFileName('a:b*c?.wav')).toBe('abc.wav')
    expect(safeFileName('...hidden')).toBe('hidden')
    expect(safeFileName('')).toBe('Motif export')
  })

  it('accepts only named ArrayBuffers', () => {
    expect(validExportFiles([{ name: 'x.wav', data: buffer('x') }])).toHaveLength(1)
    expect(validExportFiles([{ name: 'x.wav', data: 'x' }])).toBeNull()
    expect(validExportFiles([])).toBeNull()
    expect(validExportFiles('nope')).toBeNull()
  })

  it('writes files with unique names', async () => {
    const written = await writeExportFiles(join(dir, 'stems'), [
      { name: 'Song - Drums.wav', data: buffer('a') },
      { name: 'Song - Drums.wav', data: buffer('b') },
    ])
    expect(written).toEqual(['Song - Drums.wav', 'Song - Drums 2.wav'])
    expect(readdirSync(join(dir, 'stems')).sort()).toEqual([...written].sort())
    expect(readFileSync(join(dir, 'stems', 'Song - Drums 2.wav'), 'utf8')).toBe('b')
  })
})
