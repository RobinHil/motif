import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { ID } from '../model/project'

export const SCREENS = ['studio', 'mixer', 'pianoroll', 'modulation', 'arrangement', 'code'] as const
export type Screen = (typeof SCREENS)[number]

/** Interface state. Not part of the project and not undoable (SPEC 10). */
export interface UiState {
  screen: Screen
  selectedTrackId: ID | null
  codeMode: 'synced' | 'direct'
  setScreen: (screen: Screen) => void
  selectTrack: (trackId: ID | null) => void
  setCodeMode: (mode: 'synced' | 'direct') => void
}

export const uiStore = createStore<UiState>()((set) => ({
  screen: 'studio',
  selectedTrackId: null,
  codeMode: 'synced',
  setScreen: (screen) => {
    set({ screen })
  },
  selectTrack: (selectedTrackId) => {
    set({ selectedTrackId })
  },
  setCodeMode: (codeMode) => {
    set({ codeMode })
  },
}))

export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(uiStore, selector)
}
