// Drag and drop payloads between the sound browser, the tracks and the step rows.
import type { DragEvent } from 'react'
import type { CatalogSound } from './sound-catalog'

const SOUND = 'application/x-motif-sound'
const BANK = 'application/x-motif-bank'
const TRACK = 'application/x-motif-track'

export type Dropped =
  { kind: 'sound'; sound: CatalogSound } | { kind: 'bank'; bank: string } | { kind: 'track'; trackId: string }

export function dragSound(event: DragEvent, sound: CatalogSound): void {
  event.dataTransfer.setData(SOUND, JSON.stringify(sound))
  event.dataTransfer.effectAllowed = 'copy'
}

export function dragBank(event: DragEvent, bank: string): void {
  event.dataTransfer.setData(BANK, bank)
  event.dataTransfer.effectAllowed = 'copy'
}

export function dragTrack(event: DragEvent, trackId: string): void {
  event.dataTransfer.setData(TRACK, trackId)
  event.dataTransfer.effectAllowed = 'move'
}

/** Whether the drag carries something Motif can drop (types are readable during dragover). */
export function carries(event: DragEvent, ...kinds: Dropped['kind'][]): boolean {
  const types = event.dataTransfer.types
  const map = { sound: SOUND, bank: BANK, track: TRACK }
  return kinds.some((kind) => types.includes(map[kind]))
}

export function readDrop(event: DragEvent): Dropped | null {
  const track = event.dataTransfer.getData(TRACK)
  if (track) return { kind: 'track', trackId: track }
  const bank = event.dataTransfer.getData(BANK)
  if (bank) return { kind: 'bank', bank }
  const sound = event.dataTransfer.getData(SOUND)
  if (!sound) return null
  try {
    const parsed = JSON.parse(sound) as CatalogSound
    return typeof parsed.name === 'string' ? { kind: 'sound', sound: parsed } : null
  } catch {
    return null
  }
}
