import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** Where the user is in the tutorial. Not part of the project. */
export interface TutorialState {
  active: boolean
  /** Index in TUTORIAL_STEPS; equal to its length on the closing screen. */
  step: number
  set: (changes: Partial<Omit<TutorialState, 'set'>>) => void
}

export const tutorialStore = createStore<TutorialState>()((set) => ({
  active: false,
  step: 0,
  set: (changes) => set(changes),
}))

export function useTutorial<T>(selector: (state: TutorialState) => T): T {
  return useStore(tutorialStore, selector)
}
