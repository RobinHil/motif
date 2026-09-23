// What the sound browser lists: bundled sample packs (from their catalog.json) plus Strudel's
// built-in synths. Loaded once through the motif-sample protocol; no audio needed.
import { useSyncExternalStore } from 'react'

export const CATEGORIES = ['All', 'Drums', 'Synths', 'Instruments', 'Textures', 'My samples'] as const
export type Category = (typeof CATEGORIES)[number]

export interface CatalogSound {
  name: string
  category: Exclude<Category, 'All'>
}

export interface Catalog {
  banks: string[]
  sounds: CatalogSound[]
}

const PACKS = ['motif-kit']
const SYNTHS: CatalogSound[] = ['sawtooth', 'square', 'triangle', 'sine'].map((name) => ({ name, category: 'Synths' }))

let catalog: Catalog = { banks: [], sounds: SYNTHS }
const listeners = new Set<() => void>()
let loading: Promise<void> | null = null

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
        const data = (await fetch(`motif-sample://bundled/${pack}/catalog.json`).then((r) => r.json())) as PackCatalog
        if (Array.isArray(data.banks)) banks.push(...data.banks.filter((b): b is string => typeof b === 'string'))
        if (Array.isArray(data.sounds)) sounds.push(...data.sounds.filter(isSound))
      } catch (error) {
        console.warn(`[catalog] could not read ${pack}`, error)
      }
    }
    catalog = { banks, sounds: [...sounds, ...SYNTHS] }
    for (const listener of listeners) listener()
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

/** The event a preview button plays: synths need a note to be heard. */
export function previewValue(sound: CatalogSound): Record<string, unknown> {
  return sound.category === 'Synths' ? { s: sound.name, note: 'c3' } : { s: sound.name }
}
