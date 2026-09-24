import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { MidiTarget } from '../midi/targets'

export interface MidiDevice {
  name: string
  connected: boolean
}

/** MIDI state shown by the interface (SPEC 8). Not part of the project. */
export interface MidiState {
  /** Null until Web MIDI answered; false when it is unavailable. */
  supported: boolean | null
  /** Inputs seen since Motif started, by name; unplugged ones stay listed as disconnected. */
  devices: MidiDevice[]
  /** MIDI learn mode: mappable controls are outlined, the next moved control maps to `learnTarget`. */
  learning: boolean
  learnTarget: MidiTarget | null
  /** The last device a message came from, for the learn banner. */
  lastDevice: string | null
  /** Notes played on a MIDI keyboard are written into the piano roll. */
  recording: boolean
  setSupported: (supported: boolean) => void
  setDevices: (devices: MidiDevice[]) => void
  startLearning: (target?: MidiTarget | null) => void
  pickTarget: (target: MidiTarget | null) => void
  stopLearning: () => void
  setLastDevice: (name: string) => void
  setRecording: (recording: boolean) => void
}

export const midiStore = createStore<MidiState>()((set) => ({
  supported: null,
  devices: [],
  learning: false,
  learnTarget: null,
  lastDevice: null,
  recording: false,
  setSupported: (supported) => set({ supported }),
  setDevices: (devices) => set({ devices }),
  startLearning: (learnTarget = null) => set({ learning: true, learnTarget }),
  pickTarget: (learnTarget) => set({ learnTarget }),
  stopLearning: () => set({ learning: false, learnTarget: null }),
  setLastDevice: (lastDevice) => set((state) => (state.lastDevice === lastDevice ? {} : { lastDevice })),
  setRecording: (recording) => set({ recording }),
}))

export function useMidi<T>(selector: (state: MidiState) => T): T {
  return useStore(midiStore, selector)
}
