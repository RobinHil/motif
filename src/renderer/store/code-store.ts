import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { GeneratedCode } from '../codegen/generate'

/** The code generated from the current project, shown in the code panel. Set by the engine bridge. */
export interface CodeState {
  generated: GeneratedCode | null
  setGenerated: (generated: GeneratedCode) => void
}

export const codeStore = createStore<CodeState>()((set) => ({
  generated: null,
  setGenerated: (generated) => {
    set({ generated })
  },
}))

export function useCode<T>(selector: (state: CodeState) => T): T {
  return useStore(codeStore, selector)
}
