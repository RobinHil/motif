import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveSampleFile, resolveSamplePath } from './sample-path'

let base: string
let root: string
let roots: Record<string, string>

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'motif-samples-'))
  root = join(base, 'samples')
  mkdirSync(join(root, 'test', 'bd'), { recursive: true })
  writeFileSync(join(root, 'test', 'bd', '0.wav'), 'RIFF')
  writeFileSync(join(base, 'secret.wav'), 'RIFF')
  symlinkSync(join(base, 'secret.wav'), join(root, 'test', 'escape.wav'))
  roots = { bundled: root }
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('resolveSamplePath', () => {
  it('rejects motif-sample://../../etc/passwd', () => {
    expect(resolveSamplePath('motif-sample://../../etc/passwd', roots)).toBeNull()
  })

  it('accepts a file inside an allowed root', () => {
    expect(resolveSamplePath('motif-sample://bundled/test/bd/0.wav', roots)).toBe(join(root, 'test', 'bd', '0.wav'))
  })

  it('keeps dot segments inside the root, since the URL parser removes them first', () => {
    const resolved = resolveSamplePath('motif-sample://bundled/../../etc/passwd.wav', roots)
    expect(resolved).toBe(join(root, 'etc', 'passwd.wav'))
  })

  it('rejects encoded traversal', () => {
    expect(resolveSamplePath('motif-sample://bundled/..%2F..%2Fsecret.wav', roots)).toBeNull()
    expect(resolveSamplePath('motif-sample://bundled/%2e%2e%2f%2e%2e%2fsecret.wav', roots)).toBeNull()
    expect(resolveSamplePath('motif-sample://bundled/..%5C..%5Csecret.wav', roots)).toBeNull()
  })

  it('rejects absolute paths smuggled in the path', () => {
    expect(resolveSamplePath('motif-sample://bundled/%2Fetc%2Fpasswd', roots)).toBeNull()
  })

  it('rejects unknown roots, other schemes and prototype keys', () => {
    expect(resolveSamplePath('motif-sample://user/test/bd/0.wav', roots)).toBeNull()
    expect(resolveSamplePath('motif-sample://constructor/x.wav', roots)).toBeNull()
    expect(resolveSamplePath('file:///etc/passwd', roots)).toBeNull()
  })

  it('rejects null bytes, malformed escapes and the root itself', () => {
    expect(resolveSamplePath('motif-sample://bundled/test%00.wav', roots)).toBeNull()
    expect(resolveSamplePath('motif-sample://bundled/%E0%A4%A.wav', roots)).toBeNull()
    expect(resolveSamplePath('motif-sample://bundled/', roots)).toBeNull()
  })

  it('rejects non-audio files', () => {
    expect(resolveSamplePath('motif-sample://bundled/test/script.js', roots)).toBeNull()
  })
})

describe('resolveSampleFile', () => {
  it('rejects a symbolic link that points outside the root', async () => {
    expect(resolveSamplePath('motif-sample://bundled/test/escape.wav', roots)).not.toBeNull()
    await expect(resolveSampleFile('motif-sample://bundled/test/escape.wav', roots)).resolves.toBeNull()
  })

  it('resolves a real file inside the root', async () => {
    await expect(resolveSampleFile('motif-sample://bundled/test/bd/0.wav', roots)).resolves.toMatch(/0\.wav$/)
  })

  it('returns null for a missing file', async () => {
    await expect(resolveSampleFile('motif-sample://bundled/test/missing.wav', roots)).resolves.toBeNull()
  })
})
