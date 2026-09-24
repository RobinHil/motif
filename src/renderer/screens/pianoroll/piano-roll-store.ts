import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { ID, Note } from '../../model/project'
import type { EditCycle } from '../../store/note-actions'

export type Tool = 'pencil' | 'select' | 'eraser'

/** Grid sizes in 16th-note steps (SPEC 6.3). Triplets need a finer grid than the 16-step model. */
export const GRIDS = [
  { label: '1/16', steps: 1 },
  { label: '1/8', steps: 2 },
  { label: '1/4', steps: 4 },
] as const

/** Interface state of the piano roll: not part of the project, not undoable. */
export interface PianoRollState {
  tool: Tool
  grid: number
  snapToScale: boolean
  editCycle: EditCycle
  selection: ID[]
  /** Keyboard cursor, to add notes without a mouse. */
  cursor: { step: number; midi: number }
  clipboard: Note[]
  set: (changes: Partial<Omit<PianoRollState, 'set'>>) => void
}

export const pianoRollStore = createStore<PianoRollState>()((set) => ({
  tool: 'pencil',
  grid: 1,
  snapToScale: false,
  editCycle: 1,
  selection: [],
  cursor: { step: 0, midi: 60 },
  clipboard: [],
  set: (changes) => set(changes),
}))

export function usePianoRoll<T>(selector: (state: PianoRollState) => T): T {
  return useStore(pianoRollStore, selector)
}
