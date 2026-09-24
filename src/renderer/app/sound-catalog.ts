// What the sound browser lists: bundled sample packs (from their catalog.json), the user's imported
// sounds and Strudel's built-in synths. Loaded through the motif-sample protocol; no audio needed.
import { useSyncExternalStore } from 'react'
import { setSampleBanks, subscribeUserSounds, userSoundBase, userSounds } from './sample-library'

export const CATEGORIES = ['All', 'Drums', 'Synths', 'Instruments', 'Textures', 'My samples'] as const
export type Category = (typeof CATEGORIES)[number]

export interface CatalogSound {
  name: string
  category: Exclude<Category, 'All'>
  /** Number of samples (`name:0`...), when the sound is made of samples. */
  variants?: number
  /** Folder an imported sound came from, to group "My samples". */
  folder?: string
}

export interface Catalog {
  banks: string[]
  sounds: CatalogSound[]
}

const PACKS = ['motif-kit']
const SYNTHS: CatalogSound[] = ['sawtooth', 'square', 'triangle', 'sine'].map((name) => ({ name, category: 'Synths' }))

let bundled: Catalog = { banks: [], sounds: [] }
/** Sample files of bundled sounds, from each pack's Strudel manifest: name -> URLs. */
const bundledFiles = new Map<string, string[]>()
let catalog: Catalog = { banks: [], sounds: SYNTHS }
const listeners = new Set<() => void>()
let loading: Promise<void> | null = null

function rebuild() {
  const user: CatalogSound[] = userSounds().map((s) => ({
    name: s.name,
    category: 'My samples',
    variants: s.files.length,
    folder: s.folder,
  }))
  catalog = { banks: bundled.banks, sounds: [...bundled.sounds, ...user, ...SYNTHS] }
  for (const listener of listeners) listener()
}
subscribeUserSounds(rebuild)

interface PackCatalog {
  banks?: unknown
  sounds?: unknown
}

function isSound(value: unknown): value is CatalogSound {
  const sound = value as Partial<CatalogSound> | null
  return typeof sound?.name === 'string' && typeof sound.category === 'string' && CATEGORIES.includes(sound.category)
}

export function loadCatalog(): Promise<void> {
  loading ??= (async () => {
    const banks: string[] = []
    const sounds: CatalogSound[] = []
    for (const pack of PACKS) {
      try {
        const base = `motif-sample://bundled/${pack}/`
        const data = (await fetch(`${base}catalog.json`).then((r) => r.json())) as PackCatalog
        const manifest = (await fetch(`${base}strudel.json`).then((r) => r.json())) as Record<string, unknown>
        for (const [name, files] of Object.entries(manifest)) {
          if (Array.isArray(files))
            bundledFiles.set(
              name,
              files.map((f) => `${base}${String(f)}`),
            )
        }
        if (Array.isArray(data.banks)) banks.push(...data.banks.filter((b): b is string => typeof b === 'string'))
        if (Array.isArray(data.sounds))
          sounds.push(
            ...data.sounds.filter(isSound).map((s) => {
              const count = bundledFiles.get(s.name)?.length
              return count === undefined || s.category === 'Instruments' ? s : { ...s, variants: count }
            }),
          )
      } catch (error) {
        console.warn(`[catalog] could not read ${pack}`, error)
      }
    }
    bundled = { banks, sounds }
    rebuild()
    await setSampleBanks(banks)
  })()
  return loading
}

export function useCatalog(): Catalog {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      void loadCatalog()
      return () => listeners.delete(listener)
    },
    () => catalog,
  )
}

/** The event a preview button plays: synths and tuned instruments play a C. */
export function previewValue(sound: CatalogSound): Record<string, unknown> {
  return sound.category === 'Synths' || sound.category === 'Instruments'
    ? { s: sound.name, note: 'c3' }
    : { s: sound.name }
}

/** URL of one sample of a sound (`name:variant`), or null for synths and unknown sounds. */
export function sampleFileUrl(name: string, variant = 0): string | null {
  const user = userSounds().find((s) => s.name === name)
  if (user) {
    const file = user.files[variant % user.files.length]
    return file === undefined ? null : `${userSoundBase(name)}${file}`
  }
  const files = bundledFiles.get(name)
  return files?.[variant % files.length] ?? null
}
