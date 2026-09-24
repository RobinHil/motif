import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { GeneratedCode } from '../codegen/generate'
import type { ReadBackResult } from '../codegen/read-back'

/**
 * Code shown by the editors. `generated` follows the project; `draft` is the text being edited by
 * hand (direct edit, code screen), shared by both editors so nothing typed is lost when switching
 * screens. It goes back into the project on Ctrl+Enter (SPEC 6.6).
 */
export interface CodeState {
  generated: GeneratedCode | null
  draft: string | null
  /** A read-back waiting for the user's choice: convert to free code or undo. */
  pending: ReadBackResult | null
  /** Why the last read-back could not be applied. */
  issues: string[]
  /** The documented function shown in the documentation panel. */
  focusWord: string
  setGenerated: (generated: GeneratedCode) => void
  setDraft: (draft: string | null) => void
  setPending: (pending: ReadBackResult | null) => void
  setIssues: (issues: string[]) => void
  setFocusWord: (word: string) => void
}

export const codeStore = createStore<CodeState>()((set) => ({
  generated: null,
  draft: null,
  pending: null,
  issues: [],
  focusWord: 'jux',
  setGenerated: (generated) => set({ generated }),
  setDraft: (draft) => set({ draft }),
  setPending: (pending) => set({ pending }),
  setIssues: (issues) => set({ issues }),
  setFocusWord: (focusWord) => set({ focusWord }),
}))

export function useCode<T>(selector: (state: CodeState) => T): T {
  return useStore(codeStore, selector)
}
