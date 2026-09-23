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
  /** Name of the project folder, null until the project is saved. */
  fileName: string | null
  /** A short message for the user (open failed, project recovered...). */
  notice: string | null
  setScreen: (screen: Screen) => void
  selectTrack: (trackId: ID | null) => void
  setCodeMode: (mode: 'synced' | 'direct') => void
  setFileName: (fileName: string | null) => void
  setNotice: (notice: string | null) => void
}

export const uiStore = createStore<UiState>()((set) => ({
  screen: 'studio',
  selectedTrackId: null,
  codeMode: 'synced',
  fileName: null,
  notice: null,
  setScreen: (screen) => {
    set({ screen })
  },
  selectTrack: (selectedTrackId) => {
    set({ selectedTrackId })
  },
  setCodeMode: (codeMode) => {
    set({ codeMode })
  },
  setFileName: (fileName) => {
    set({ fileName })
  },
  setNotice: (notice) => {
    set({ notice })
  },
}))

export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(uiStore, selector)
}
