// Project folders on disk (SPEC 3, "File format"): `MySong.motif/project.json` plus `samples/`.
// Node only, no Electron import, so it can be unit tested.
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

export const PROJECT_EXTENSION = '.motif'
export const PROJECT_FILE = 'project.json'
export const SAMPLES_DIR = 'samples'
/** Far above any real project; protects the main process from absurd payloads. */
export const MAX_PROJECT_BYTES = 50 * 1024 * 1024

export class ProjectFileError extends Error {
  override name = 'ProjectFileError'
}

/** `~/Music/My song` -> `~/Music/My song.motif`. */
export function withProjectExtension(path: string): string {
  return extname(path).toLowerCase() === PROJECT_EXTENSION ? path : `${path}${PROJECT_EXTENSION}`
}

export function projectNameFromDir(dir: string): string {
  return basename(dir, extname(dir))
}

export function assertProjectText(text: unknown): asserts text is string {
  if (typeof text !== 'string') throw new ProjectFileError('Project data must be text.')
  if (Buffer.byteLength(text, 'utf8') > MAX_PROJECT_BYTES) throw new ProjectFileError('Project data is too large.')
}

/** Writes through a temporary file and a rename, so a crash never leaves a half-written file. */
export async function writeFileAtomic(path: string, text: string): Promise<void> {
  const temporary = `${path}.tmp-${String(process.pid)}`
  await writeFile(temporary, text, 'utf8')
  try {
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

export async function writeProjectFolder(dir: string, text: string): Promise<void> {
  assertProjectText(text)
  if (extname(dir).toLowerCase() !== PROJECT_EXTENSION) {
    throw new ProjectFileError(`A project folder must end with ${PROJECT_EXTENSION}.`)
  }
  await mkdir(join(dir, SAMPLES_DIR), { recursive: true })
  await writeFileAtomic(join(dir, PROJECT_FILE), text)
}

export async function readProjectFolder(dir: string): Promise<string> {
  if (extname(dir).toLowerCase() !== PROJECT_EXTENSION) {
    throw new ProjectFileError(`Choose a folder whose name ends with ${PROJECT_EXTENSION}.`)
  }
  const file = join(dir, PROJECT_FILE)
  let size: number
  try {
    size = (await stat(file)).size
  } catch {
    throw new ProjectFileError(`This folder has no ${PROJECT_FILE}.`)
  }
  if (size > MAX_PROJECT_BYTES) throw new ProjectFileError('This project file is too large.')
  return readFile(file, 'utf8')
}

/**
 * Whether a project contains code that Motif did not write: free code tracks or custom transforms.
 * Used to warn before opening a project received from someone else (AGENTS.md, Electron security).
 */
export function containsFreeCode(text: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return false
  }
  const tracks = (parsed as { tracks?: unknown }).tracks
  if (!Array.isArray(tracks)) return false
  return tracks.some((track: unknown) => {
    if (typeof track !== 'object' || track === null) return false
    const { kind, transforms } = track as { kind?: unknown; transforms?: unknown }
    if (kind === 'code') return true
    return (
      Array.isArray(transforms) && transforms.some((t: unknown) => (t as { type?: unknown } | null)?.type === 'custom')
    )
  })
}
