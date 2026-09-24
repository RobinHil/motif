import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Settings } from '@shared/ipc'

/** This computer's settings, as saved by the main process. Null until read. */
export interface SettingsState {
  settings: Settings | null
  setSettings: (settings: Settings) => void
}

export const settingsStore = createStore<SettingsState>()((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings }),
}))

export function useSettings<T>(selector: (state: SettingsState) => T): T {
  return useStore(settingsStore, selector)
}
