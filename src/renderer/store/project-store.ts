import { produce, type Draft } from 'immer'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { createDemoProject } from '../model/demo'
import type { Project } from '../model/project'

/** SPEC 10 requires at least 200 undo levels. */
export const MAX_HISTORY = 500

export type Recipe = (draft: Draft<Project>) => void

export interface ProjectState {
  project: Project
  /** Older snapshots, most recent last. */
  past: Project[]
  future: Project[]
  /** Snapshot taken when a continuous gesture started; edits during the gesture are not recorded. */
  gestureBase: Project | null
  /** The project as last saved, to know whether there are unsaved changes. */
  saved: Project | null

  /** Replaces the project and clears the history (new, open, recovery). */
  load: (project: Project, options?: { saved?: boolean }) => void
  /** Applies an edit. Outside a gesture, it becomes one undo step. */
  update: (recipe: Recipe) => void
  /** Starts a continuous gesture (dragging a knob, painting steps): it will form one undo step. */
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  markSaved: () => void
}

function pushBounded(stack: readonly Project[], project: Project): Project[] {
  const next = [...stack, project]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

export function createProjectStore(initial: Project = createDemoProject()): StoreApi<ProjectState> {
  return createStore<ProjectState>()((set, get) => {
    const commitGesture = () => {
      const { gestureBase, project, past } = get()
      if (gestureBase === null) return
      set(
        gestureBase === project
          ? { gestureBase: null }
          : { gestureBase: null, past: pushBounded(past, gestureBase), future: [] },
      )
    }

    return {
      project: initial,
      past: [],
      future: [],
      gestureBase: null,
      saved: null,

      load(project, options = {}) {
        set({ project, past: [], future: [], gestureBase: null, saved: options.saved ? project : null })
      },

      update(recipe) {
        const { project, past, gestureBase } = get()
        const next = produce(project, recipe)
        if (next === project) return
        set(gestureBase !== null ? { project: next } : { project: next, past: pushBounded(past, project), future: [] })
      },

      beginGesture() {
        if (get().gestureBase === null) set({ gestureBase: get().project })
      },

      endGesture: commitGesture,

      undo() {
        commitGesture()
        const { past, project, future } = get()
        const previous = past.at(-1)
        if (previous === undefined) return
        set({ project: previous, past: past.slice(0, -1), future: [...future, project] })
      },

      redo() {
        commitGesture()
        const { past, project, future } = get()
        const next = future.at(-1)
        if (next === undefined) return
        set({ project: next, past: pushBounded(past, project), future: future.slice(0, -1) })
      },

      markSaved() {
        set({ saved: get().project })
      },
    }
  })
}

/** The app's project store. Components select only what they display (golden rule 4). */
export const projectStore = createProjectStore()

export function useProject<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector)
}

export const selectCanUndo = (state: ProjectState) => state.past.length > 0 || state.gestureBase !== null
export const selectCanRedo = (state: ProjectState) => state.future.length > 0
export const selectIsDirty = (state: ProjectState) => state.project !== state.saved
