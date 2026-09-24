// The user's sample library (SPEC 7, "User imports"): imported files are copied into one folder of
// the profile, so they keep working when the originals move, and copied again into a project's
// `samples/` folder when it is saved. Node only, no Electron import.
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import type { ImportResult, LibrarySound } from '@shared/ipc'
import { isAudioFile, soundNameFrom, uniqueName } from '@shared/samples'
import { writeFileAtomic } from './project-files'

const INDEX_FILE = 'library.json'
export const MAX_IMPORT_FILES = 1000
export const MAX_SAMPLE_BYTES = 500 * 1024 * 1024
const SOUND_NAME = /^[a-z][a-z0-9_]{0,31}$/
const RELATIVE_FILE = /^[a-z][a-z0-9_]{0,31}\/\d{1,4}\.[a-z0-9]{2,5}$/

const naturalOrder = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })

/** Whether `file` is a relative path the library writes (`name/12.wav`), so it cannot leave a folder. */
export function isLibraryFile(file: unknown): file is string {
  return typeof file === 'string' && RELATIVE_FILE.test(file)
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function parseSounds(value: unknown): LibrarySound[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry: unknown) => {
    const { name, files, folder } = (entry ?? {}) as Partial<LibrarySound>
    if (typeof name !== 'string' || !SOUND_NAME.test(name) || !Array.isArray(files)) return []
    const valid = files.filter(isLibraryFile)
    if (valid.length === 0) return []
    return [{ name, files: valid, folder: typeof folder === 'string' ? folder.slice(0, 200) : '' }]
  })
}

/** Imported sounds named in a project's JSON (`sampleLibrary`, origin "user"), validated. */
export function projectSampleEntries(text: string): LibrarySound[] {
  try {
    const parsed = JSON.parse(text) as { sampleLibrary?: unknown }
    const entries = Array.isArray(parsed.sampleLibrary)
      ? parsed.sampleLibrary.filter((e: unknown) => (e as { origin?: unknown } | null)?.origin === 'user')
      : []
    return parseSounds(entries)
  } catch {
    return []
  }
}

interface Group {
  name: string
  folder: string
  files: string[]
}

export class SampleLibrary {
  private sounds: LibrarySound[] | null = null

  constructor(
    private folder: string,
    /** Names already used by bundled sounds and synths. */
    private readonly reserved: ReadonlySet<string>,
  ) {}

  get root(): string {
    return this.folder
  }

  /**
   * Uses another folder for the library. A folder that already holds a Motif library is adopted as
   * it is; otherwise the current sounds are copied there, then removed from the old folder.
   */
  async moveTo(folder: string): Promise<void> {
    const target = resolve(folder)
    if (target === resolve(this.folder)) return
    if (await exists(join(target, INDEX_FILE))) {
      this.folder = target
      this.sounds = null
      return
    }
    const sounds = await this.list()
    for (const file of sounds.flatMap((s) => s.files)) {
      await mkdir(dirname(join(target, file)), { recursive: true })
      await copyFile(join(this.folder, file), join(target, file))
    }
    const old = this.folder
    this.folder = target
    await this.save(sounds)
    for (const sound of sounds) await rm(join(old, sound.name), { recursive: true, force: true })
    await rm(join(old, INDEX_FILE), { force: true })
  }

  /** Removes a sound and its files from the library (projects keep their own copies). */
  async remove(name: string): Promise<void> {
    const sounds = await this.list()
    if (!sounds.some((s) => s.name === name)) return
    await rm(join(this.folder, name), { recursive: true, force: true })
    await this.save(sounds.filter((s) => s.name !== name))
  }

  async list(): Promise<LibrarySound[]> {
    if (this.sounds) return this.sounds
    try {
      this.sounds = parseSounds(JSON.parse(await readFile(join(this.root, INDEX_FILE), 'utf8')))
    } catch {
      this.sounds = []
    }
    return this.sounds
  }

  private async save(sounds: LibrarySound[]): Promise<void> {
    this.sounds = sounds
    await mkdir(this.folder, { recursive: true })
    await writeFileAtomic(join(this.root, INDEX_FILE), JSON.stringify(sounds, null, 2))
  }

  /**
   * Imports dropped or chosen files and folders. A folder's audio files become one sound with one
   * variant per file (natural order); each subfolder becomes its own sound; a loose file is a sound.
   */
  async import(paths: readonly string[]): Promise<ImportResult> {
    const rejected: ImportResult['rejected'] = []
    const groups: Group[] = []
    let count = 0

    const collect = async (dir: string, folder: string, depth: number) => {
      const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => naturalOrder(a.name, b.name))
      const files: string[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (depth < 4) await collect(path, folder, depth + 1)
        } else if (entry.isFile()) {
          if (isAudioFile(entry.name)) files.push(path)
          else rejected.push({ file: entry.name, reason: 'not an audio format Motif can read' })
        }
      }
      if (files.length > 0) groups.push({ name: basename(dir), folder, files })
    }

    for (const path of paths) {
      let info
      try {
        info = await stat(path)
      } catch {
        rejected.push({ file: basename(path), reason: 'not found' })
        continue
      }
      if (info.isDirectory()) await collect(path, basename(path), 0)
      else if (!isAudioFile(path)) rejected.push({ file: basename(path), reason: 'not an audio format Motif can read' })
      else groups.push({ name: basename(path, extname(path)), folder: basename(dirname(path)), files: [path] })
    }

    const sounds = [...(await this.list())]
    const taken = new Set([...this.reserved, ...sounds.map((s) => s.name)])
    const added: ImportResult['added'] = []
    for (const group of groups) {
      const name = uniqueName(soundNameFrom(group.name), taken)
      const files: string[] = []
      const sources: string[] = []
      for (const source of group.files) {
        if (count >= MAX_IMPORT_FILES) {
          rejected.push({ file: basename(source), reason: `more than ${String(MAX_IMPORT_FILES)} files in one import` })
          continue
        }
        if ((await stat(source)).size > MAX_SAMPLE_BYTES) {
          rejected.push({ file: basename(source), reason: 'larger than 500 MB' })
          continue
        }
        const file = `${name}/${String(files.length)}${extname(source).toLowerCase()}`
        await mkdir(join(this.root, name), { recursive: true })
        await copyFile(source, join(this.root, file))
        files.push(file)
        sources.push(basename(source))
        count++
      }
      if (files.length === 0) continue
      taken.add(name)
      added.push({ name, files, folder: group.folder, sources })
    }
    if (added.length > 0)
      await this.save([...sounds, ...added.map(({ name, files, folder }) => ({ name, files, folder }))])
    return { added, rejected }
  }

  /** Removes files the renderer could not decode; a sound left without files is removed. */
  async removeFiles(name: string, files: readonly string[]): Promise<void> {
    const sounds = await this.list()
    const sound = sounds.find((s) => s.name === name)
    if (!sound) return
    const doomed = files.filter((f) => sound.files.includes(f))
    for (const file of doomed) await rm(join(this.root, file), { force: true })
    const kept = sound.files.filter((f) => !doomed.includes(f))
    if (kept.length === 0) await rm(join(this.root, name), { recursive: true, force: true })
    await this.save(
      kept.length === 0
        ? sounds.filter((s) => s !== sound)
        : sounds.map((s) => (s === sound ? { ...s, files: kept } : s)),
    )
  }

  /**
   * Copies the files of `entries` into a project's samples folder, from the library or from the
   * folder the project was opened from. Files already there are kept.
   */
  async copyToProject(entries: readonly LibrarySound[], samplesDir: string, previousSamplesDir: string | null) {
    const missing: string[] = []
    for (const file of entries.flatMap((e) => e.files).filter(isLibraryFile)) {
      const target = resolve(samplesDir, file)
      if (!isInside(resolve(samplesDir), target)) continue
      if (await exists(target)) continue
      const sources = [join(this.root, file), ...(previousSamplesDir ? [join(previousSamplesDir, file)] : [])]
      let copied = false
      for (const source of sources) {
        if (!(await exists(source))) continue
        await mkdir(dirname(target), { recursive: true })
        await copyFile(source, target)
        copied = true
        break
      }
      if (!copied) missing.push(file)
    }
    return missing
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
