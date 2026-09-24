// Reads and changes this computer's settings, and applies them to the audio engine.
import type { Settings } from '@shared/ipc'
import { configureAudio } from '../engine/engine'
import { settingsStore } from '../store/settings-store'

async function apply(settings: Settings) {
  settingsStore.getState().setSettings(settings)
  await configureAudio({ latency: settings.latency, output: settings.audioOutput })
}

/** Called before the engine starts, so the latency setting is used. */
export async function loadSettings(): Promise<void> {
  await apply(await window.motif.settings.get())
}

export async function changeSettings(changes: Partial<Settings>): Promise<void> {
  await apply(await window.motif.settings.set(changes))
}
