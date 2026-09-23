import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { ID } from '../model/project'

export interface TrackError {
  message: string
  /** Line in the generated code, when Strudel reported one. */
  line?: number
}

/**
 * Playback state shown by the interface. It changes on user actions and evaluation results only:
 * the playhead position is read from the engine in a requestAnimationFrame loop, never stored here
 * (golden rule 3).
 */
export interface TransportState {
  playing: boolean
  errors: Record<ID, TrackError>
  /** An error that could not be attached to a track. */
  globalError: string | null
  setPlaying: (playing: boolean) => void
  setErrors: (errors: Record<ID, TrackError>, globalError: string | null) => void
}

export const transportStore = createStore<TransportState>()((set) => ({
  playing: false,
  errors: {},
  globalError: null,
  setPlaying: (playing) => {
    set({ playing })
  },
  setErrors: (errors, globalError) => {
    set({ errors, globalError })
  },
}))

export function useTransport<T>(selector: (state: TransportState) => T): T {
  return useStore(transportStore, selector)
}
