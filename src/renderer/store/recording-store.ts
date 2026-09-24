import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** Recording options and state (SPEC 6.2, Output panel; SPEC 9). Not part of the project. */
export interface RecordingState {
  bitDepth: 16 | 24
  stems: boolean
  /** "Record output" is running. */
  recording: boolean
  /** An export is recording in real time. */
  exporting: boolean
  set: (changes: Partial<Omit<RecordingState, 'set'>>) => void
}

export const recordingStore = createStore<RecordingState>()((set) => ({
  bitDepth: 24,
  stems: false,
  recording: false,
  exporting: false,
  set: (changes) => set(changes),
}))

export function useRecording<T>(selector: (state: RecordingState) => T): T {
  return useStore(recordingStore, selector)
}
