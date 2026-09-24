// The settings file of this computer (SPEC 10). Node only, no Electron import.
import { readFile } from 'node:fs/promises'
import { LATENCIES, ZOOMS, type Settings } from '@shared/ipc'
import { writeFileAtomic } from './project-files'

export const DEFAULT_SETTINGS: Settings = {
  audioOutput: null,
  latency: 'interactive',
  midiDisabled: [],
  zoom: 1,
  language: 'en',
}

/** Keeps the valid fields of `value`: anything else, from an old file or the renderer, is ignored. */
export function validSettings(value: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const input = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const next = { ...base }
  const output = input['audioOutput']
  if (output === null || (typeof output === 'string' && output.length <= 512)) next.audioOutput = output
  const latency = input['latency']
  if ((LATENCIES as readonly unknown[]).includes(latency)) next.latency = latency as Settings['latency']
  const disabled = input['midiDisabled']
  if (
    Array.isArray(disabled) &&
    disabled.length <= 256 &&
    disabled.every((d) => typeof d === 'string' && d.length <= 256)
  )
    next.midiDisabled = [...new Set(disabled as string[])]
  const zoom = input['zoom']
  if ((ZOOMS as readonly unknown[]).includes(zoom)) next.zoom = zoom as Settings['zoom']
  return next
}

export class SettingsFile {
  private settings: Settings | null = null

  constructor(private readonly file: string) {}

  async get(): Promise<Settings> {
    if (this.settings) return this.settings
    try {
      this.settings = validSettings(JSON.parse(await readFile(this.file, 'utf8')))
    } catch {
      this.settings = { ...DEFAULT_SETTINGS }
    }
    return this.settings
  }

  async update(changes: unknown): Promise<Settings> {
    const next = validSettings(changes, await this.get())
    this.settings = next
    await writeFileAtomic(this.file, JSON.stringify(next, null, 2))
    return next
  }
}
