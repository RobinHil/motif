export const IPC = {
  projectOpen: 'project:open',
  projectSave: 'project:save',
  projectSaveAs: 'project:save-as',
  projectNew: 'project:new',
  projectRecent: 'project:recent',
  projectOpenRecent: 'project:open-recent',
  recoveryWrite: 'recovery:write',
  recoveryTake: 'recovery:take',
  recoveryClear: 'recovery:clear',
  samplesLibrary: 'samples:library',
  samplesImport: 'samples:import',
  samplesImportDialog: 'samples:import-dialog',
  samplesRemoveFiles: 'samples:remove-files',
  samplesRemove: 'samples:remove',
  samplesFolder: 'samples:folder',
  samplesMoveFolder: 'samples:move-folder',
  samplesShowFolder: 'samples:show-folder',
  exportSave: 'export:save',
  appLicenses: 'app:licenses',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
} as const

export type OpenResult =
  { status: 'opened'; text: string; name: string } | { status: 'canceled' } | { status: 'error'; message: string }

export type SaveResult =
  | {
      status: 'saved'
      name: string
      /** Imported sample files that could not be copied into the project folder. */
      missingSamples: string[]
    }
  | { status: 'canceled' }
  | { status: 'error'; message: string }

export interface RecentProject {
  /** Opaque: the folder path never leaves the main process. */
  id: string
  name: string
}

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
    recent(): Promise<RecentProject[]>
    openRecent(id: string): Promise<OpenResult>
  }
  readonly samples: {
    /** The user's imported sounds. */
    library(): Promise<LibrarySound[]>
    /** Imports dropped files and folders (File objects from a drop event, not paths). */
    importFiles(files: readonly File[]): Promise<ImportResult>
    /** Shows a dialog to pick files or a folder. Null when canceled. */
    importDialog(kind: 'files' | 'folder'): Promise<ImportResult | null>
    /** Drops files the audio engine could not decode. */
    removeFiles(name: string, files: readonly string[]): Promise<void>
    /** Removes a sound from the library. Projects keep their own copies. */
    remove(name: string): Promise<void>
    /** Where the library lives on this computer. */
    folder(): Promise<string>
    /** Asks for another folder and moves the library there. Null when canceled. */
    moveFolder(): Promise<string | null>
    showFolder(): Promise<void>
  }
  readonly export: {
    /**
     * Asks where to save and writes the files: one file through a save dialog, several (stems)
     * into a chosen folder. Names are file names only, never paths.
     */
    save(files: readonly ExportFile[], kind: 'wav' | 'js'): Promise<ExportResult>
  }
  readonly app: {
    /** The license texts of the bundled samples and third-party code, for the About window. */
    licenses(): Promise<string>
  }
  readonly settings: {
    get(): Promise<Settings>
    /** Saves valid fields and applies the zoom at once. */
    set(changes: Partial<Settings>): Promise<Settings>
  }
  readonly recovery: {
    write(text: string): Promise<void>
    /** The autosaved project after a crash, once; null otherwise. */
    take(): Promise<RecoveredProject | null>
    clear(): Promise<void>
  }
}

/** A sound of the user's library: `files` are relative paths like `breaks/0.wav`. */
export interface LibrarySound {
  name: string
  files: string[]
  /** Folder it was imported from, used to group "My samples". */
  folder: string
}

export interface ImportResult {
  /** New sounds, with the original file name of each file (for messages). */
  added: (LibrarySound & { sources: string[] })[]
  /** File names (never full paths) that were not imported, with the reason. */
  rejected: { file: string; reason: string }[]
}

export const LATENCIES = ['interactive', 'balanced', 'playback'] as const
export const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const

/** Preferences of this computer (SPEC 10, Settings). Not part of any project. */
export interface Settings {
  /** Audio output device id, null for the system default. */
  audioOutput: string | null
  /** AudioContext latency hint; applies the next time Motif starts. */
  latency: (typeof LATENCIES)[number]
  /** Names of MIDI inputs the user switched off. */
  midiDisabled: string[]
  /** UI scale. */
  zoom: (typeof ZOOMS)[number]
  /** English only in v1. */
  language: 'en'
}

export interface ExportFile {
  name: string
  data: ArrayBuffer
}

export type ExportResult =
  { status: 'saved'; where: string } | { status: 'canceled' } | { status: 'error'; message: string }
