import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { ID, ParamKey } from '../model/project'

export const SCREENS = ['studio', 'mixer', 'pianoroll', 'modulation', 'arrangement', 'code'] as const
export type Screen = (typeof SCREENS)[number]

/** Interface state. Not part of the project and not undoable (SPEC 10). */
export interface UiState {
  /** The home screen (new, open, recent, demo) is shown instead of the six screens. */
  home: boolean
  screen: Screen
  selectedTrackId: ID | null
  /** Parameter shown on the modulation screen, for the selected track. */
  modulationKey: ParamKey | null
  codeMode: 'synced' | 'direct'
  /** Name of the project folder, null until the project is saved. */
  fileName: string | null
  /** A short message for the user (open failed, project recovered...). */
  notice: string | null
  helpOpen: boolean
  /** Visualizations of the code screen (SPEC 6.6). */
  liveHighlight: boolean
  visuals: { punchcard: boolean; pianoroll: boolean; spectrum: boolean }
  setHome: (home: boolean) => void
  setScreen: (screen: Screen) => void
  selectTrack: (trackId: ID | null) => void
  /** Shows the modulation screen for one parameter of a track (knob menu "Animate"). */
  openModulation: (trackId: ID, key: ParamKey) => void
  setModulationKey: (key: ParamKey | null) => void
  setCodeMode: (mode: 'synced' | 'direct') => void
  setFileName: (fileName: string | null) => void
  setNotice: (notice: string | null) => void
  setHelpOpen: (open: boolean) => void
  setLiveHighlight: (on: boolean) => void
  setVisual: (visual: 'punchcard' | 'pianoroll' | 'spectrum', on: boolean) => void
}

export const uiStore = createStore<UiState>()((set) => ({
  home: false,
  screen: 'studio',
  selectedTrackId: null,
  modulationKey: null,
  codeMode: 'synced',
  fileName: null,
  notice: null,
  helpOpen: false,
  liveHighlight: true,
  visuals: { punchcard: false, pianoroll: false, spectrum: false },
  setHome: (home) => {
    set({ home })
  },
  setScreen: (screen) => {
    set({ screen, home: false })
  },
  selectTrack: (selectedTrackId) => {
    set({ selectedTrackId })
  },
  openModulation: (selectedTrackId, modulationKey) => {
    set({ selectedTrackId, modulationKey, screen: 'modulation', home: false })
  },
  setModulationKey: (modulationKey) => {
    set({ modulationKey })
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
  setHelpOpen: (helpOpen) => {
    set({ helpOpen })
  },
  setLiveHighlight: (liveHighlight) => {
    set({ liveHighlight })
  },
  setVisual: (visual, on) => {
    set((state) => ({ visuals: { ...state.visuals, [visual]: on } }))
  },
}))

export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(uiStore, selector)
}
