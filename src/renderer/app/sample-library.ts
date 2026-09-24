// The user's imported sounds (SPEC 7): the library kept by the main process, plus sounds a project
// brought with it in its own `samples/` folder. Registers them with Strudel and checks imports.
import type { ImportResult } from '@shared/ipc'
import { decodeSample, registerSamples } from '../engine/engine'
import type { SampleEntry } from '../model/project'
import type { UserSound } from '../model/samples'

export const LIBRARY_URL = 'motif-sample://library/'
export const PROJECT_SAMPLES_URL = 'motif-sample://project/'
/** SPEC 7: samples are fully loaded into memory, so long files get a warning. */
export const LONG_SAMPLE_SECONDS = 60

let library: UserSound[] = []
/** Bundled drum banks: `.bank("MotifKit")` makes Strudel look for `MotifKit_<sound>`. */
let banks: readonly string[] = []
let projectOnly: UserSound[] = []
let sounds: readonly UserSound[] = []
const listeners = new Set<() => void>()

function publish() {
  const names = new Set(library.map((s) => s.name))
  sounds = [...library, ...projectOnly.filter((s) => !names.has(s.name))]
  for (const listener of listeners) listener()
}

export function subscribeUserSounds(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Library sounds first, then sounds that only exist in the open project's folder. */
export function userSounds(): readonly UserSound[] {
  return sounds
}

/** Where a user sound's files are served from. */
export function userSoundBase(name: string): string {
  return library.some((s) => s.name === name) ? LIBRARY_URL : PROJECT_SAMPLES_URL
}

/** Each sound under its own name and under every bank prefix, so it also plays on a drum track with a bank. */
const asMap = (list: readonly UserSound[]) =>
  Object.fromEntries(
    list.flatMap((s) => [[s.name, s.files] as const, ...banks.map((bank) => [`${bank}_${s.name}`, s.files] as const)]),
  )

/** Called once the bundled catalog is read; registers the bank aliases of sounds already known. */
export async function setSampleBanks(next: readonly string[]): Promise<void> {
  banks = next
  if (library.length > 0) await registerSamples(asMap(library), LIBRARY_URL)
  if (projectOnly.length > 0) await registerSamples(asMap(projectOnly), PROJECT_SAMPLES_URL)
}

export async function loadLibrary(): Promise<void> {
  library = await window.motif.samples.library()
  publish()
  if (library.length > 0) await registerSamples(asMap(library), LIBRARY_URL)
}

/**
 * Called when a project is loaded: its imported sounds missing from this machine's library are
 * played from the project folder (a project moved to another computer keeps its samples).
 */
export async function syncProjectSamples(entries: readonly SampleEntry[]): Promise<void> {
  const names = new Set(library.map((s) => s.name))
  const next = entries
    .filter((e) => e.origin === 'user' && !names.has(e.name))
    .map((e) => ({ name: e.name, files: [...e.files], folder: e.folder ?? 'This project' }))
  const known = new Set(projectOnly.map((s) => `${s.name} ${s.files.join(',')}`))
  const fresh = next.filter((s) => !known.has(`${s.name} ${s.files.join(',')}`))
  projectOnly = next
  publish()
  if (fresh.length > 0) await registerSamples(asMap(fresh), PROJECT_SAMPLES_URL)
}

function listNames(items: string[]): string {
  return items.length <= 3 ? items.join(', ') : `${items.slice(0, 3).join(', ')} and ${String(items.length - 3)} more`
}

/**
 * Finishes an import: every file is decoded once, files that are not audio are removed again, the
 * rest is registered with Strudel right away. Returns the message to show.
 */
export async function finishImport(
  result: ImportResult | null,
): Promise<{ added: UserSound[]; message: string } | null> {
  if (result === null) return null
  const rejected = [...result.rejected]
  const long: string[] = []
  const added: UserSound[] = []
  for (const sound of result.added) {
    const bad: string[] = []
    for (const [index, file] of sound.files.entries()) {
      const original = sound.sources[index] ?? file
      try {
        const buffer = await decodeSample(`${LIBRARY_URL}${file}`)
        if (buffer.duration > LONG_SAMPLE_SECONDS) long.push(`${original} (${String(Math.round(buffer.duration))} s)`)
      } catch {
        bad.push(file)
        rejected.push({ file: original, reason: 'could not be decoded' })
      }
    }
    if (bad.length > 0) await window.motif.samples.removeFiles(sound.name, bad)
    const files = sound.files.filter((f) => !bad.includes(f))
    if (files.length > 0) added.push({ name: sound.name, folder: sound.folder, files })
  }
  library = await window.motif.samples.library()
  publish()
  if (added.length > 0) await registerSamples(asMap(added), LIBRARY_URL)

  const parts: string[] = []
  const first = added[0]
  if (added.length === 1 && first)
    parts.push(
      `Imported ${first.name}${first.files.length > 1 ? ` (${String(first.files.length)} variants, ${first.name}:0 to ${first.name}:${String(first.files.length - 1)})` : ''}.`,
    )
  else if (added.length > 1)
    parts.push(`Imported ${String(added.length)} sounds: ${listNames(added.map((s) => s.name))}.`)
  else parts.push('Nothing was imported.')
  if (rejected.length > 0) {
    const reasons = [...new Set(rejected.map((r) => r.reason))]
    parts.push(
      `Not imported: ${listNames(rejected.map((r) => r.file))} (${reasons.join('; ')}). Motif reads WAV, MP3, OGG, FLAC, M4A, AAC, Opus and WebM.`,
    )
  }
  if (long.length > 0) parts.push(`Longer than 60 seconds, loaded fully into memory: ${listNames(long)}.`)
  return { added, message: parts.join(' ') }
}
