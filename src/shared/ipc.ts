export const IPC = {
  projectOpen: 'project:open',
  projectSave: 'project:save',
  projectSaveAs: 'project:save-as',
  projectNew: 'project:new',
  recoveryWrite: 'recovery:write',
  recoveryTake: 'recovery:take',
  recoveryClear: 'recovery:clear',
} as const

export type OpenResult =
  { status: 'opened'; text: string; name: string } | { status: 'canceled' } | { status: 'error'; message: string }

export type SaveResult =
  { status: 'saved'; name: string } | { status: 'canceled' } | { status: 'error'; message: string }

export interface RecoveredProject {
  text: string
  /** Name of the project folder it belonged to, or null if it was never saved. */
  name: string | null
  savedAt: string
}

/**
 * Everything the renderer can ask of the main process. Project code runs in the renderer, so this
 * API must stay harmless: files are only written inside folders the user picked in a dialog.
 */
export interface MotifApi {
  readonly platform: string
  readonly project: {
    /** Shows the open dialog. Warns before opening someone else's project that contains free code. */
    open(): Promise<OpenResult>
    /** Saves to the current project folder, or asks for one. */
    save(text: string, suggestedName: string): Promise<SaveResult>
    saveAs(text: string, suggestedName: string): Promise<SaveResult>
    /** Forgets the current project folder (new project). */
    reset(): Promise<void>
  }
  readonly recovery: {
    write(text: string): Promise<void>
    /** The autosaved project after a crash, once; null otherwise. */
    take(): Promise<RecoveredProject | null>
    clear(): Promise<void>
  }
}
