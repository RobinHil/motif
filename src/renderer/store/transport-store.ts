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
export type ArrangeMode = 'song' | 'live'

export interface TransportState {
  playing: boolean
  /** Song: the arrangement plays. Live: scenes are started by hand (SPEC 6.5). */
  arrangeMode: ArrangeMode
  /** Live mode: the scene playing, or null for every track. */
  liveScene: ID | null
  /** Live mode: a scene waiting for the start of cycle `atCycle`. */
  queued: { sceneId: ID; atCycle: number } | null
  errors: Record<ID, TrackError>
  /** An error that could not be attached to a track. */
  globalError: string | null
  setPlaying: (playing: boolean) => void
  setArrangeMode: (mode: ArrangeMode) => void
  setLiveScene: (sceneId: ID | null) => void
  queueScene: (sceneId: ID, atCycle: number) => void
  /** The queued scene has started. */
  commitQueued: () => void
  setErrors: (errors: Record<ID, TrackError>, globalError: string | null) => void
}

export const transportStore = createStore<TransportState>()((set) => ({
  playing: false,
  arrangeMode: 'live',
  liveScene: null,
  queued: null,
  errors: {},
  globalError: null,
  setPlaying: (playing) => {
    set({ playing })
  },
  setArrangeMode: (arrangeMode) => {
    set({ arrangeMode, queued: null })
  },
  setLiveScene: (liveScene) => {
    set({ liveScene, queued: null })
  },
  queueScene: (sceneId, atCycle) => {
    set({ queued: { sceneId, atCycle } })
  },
  commitQueued: () => {
    set((state) => (state.queued ? { liveScene: state.queued.sceneId, queued: null } : {}))
  },
  setErrors: (errors, globalError) => {
    set({ errors, globalError })
  },
}))

export function useTransport<T>(selector: (state: TransportState) => T): T {
  return useStore(transportStore, selector)
}
