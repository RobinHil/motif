import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  IPC,
  type MotifApi,
  type ExportResult,
  type ImportResult,
  type LibrarySound,
  type OpenResult,
  type RecentProject,
  type RecoveredProject,
  type SaveResult,
  type Settings,
} from '@shared/ipc'

const api: MotifApi = {
  platform: process.platform,
  project: {
    open: () => ipcRenderer.invoke(IPC.projectOpen) as Promise<OpenResult>,
    save: (text, suggestedName) => ipcRenderer.invoke(IPC.projectSave, text, suggestedName) as Promise<SaveResult>,
    saveAs: (text, suggestedName) => ipcRenderer.invoke(IPC.projectSaveAs, text, suggestedName) as Promise<SaveResult>,
    reset: () => ipcRenderer.invoke(IPC.projectNew) as Promise<void>,
    recent: () => ipcRenderer.invoke(IPC.projectRecent) as Promise<RecentProject[]>,
    openRecent: (id) => ipcRenderer.invoke(IPC.projectOpenRecent, id) as Promise<OpenResult>,
    pendingOpen: () => ipcRenderer.invoke(IPC.projectPendingOpen) as Promise<OpenResult | null>,
    createStarter: (text) => ipcRenderer.invoke(IPC.projectCreateStarter, text) as Promise<OpenResult>,
    onOpenedExternally: (listener) => {
      const handler = (_event: unknown, result: OpenResult) => listener(result)
      ipcRenderer.on(IPC.projectOpenedExternally, handler)
      return () => ipcRenderer.off(IPC.projectOpenedExternally, handler)
    },
  },
  samples: {
    library: () => ipcRenderer.invoke(IPC.samplesLibrary) as Promise<LibrarySound[]>,
    // Only real dropped files have a path: a File built by page code maps to '' and is skipped.
    importFiles: (files) => {
      const paths = Array.from(files, (file) => (file instanceof File ? webUtils.getPathForFile(file) : '')).filter(
        (path) => path !== '',
      )
      return ipcRenderer.invoke(IPC.samplesImport, paths) as Promise<ImportResult>
    },
    importDialog: (kind) => ipcRenderer.invoke(IPC.samplesImportDialog, kind) as Promise<ImportResult | null>,
    removeFiles: (name, files) => ipcRenderer.invoke(IPC.samplesRemoveFiles, name, [...files]) as Promise<void>,
    remove: (name) => ipcRenderer.invoke(IPC.samplesRemove, name) as Promise<void>,
    folder: () => ipcRenderer.invoke(IPC.samplesFolder) as Promise<string>,
    moveFolder: () => ipcRenderer.invoke(IPC.samplesMoveFolder) as Promise<string | null>,
    showFolder: () => ipcRenderer.invoke(IPC.samplesShowFolder) as Promise<void>,
  },
  export: {
    save: (files, kind) => ipcRenderer.invoke(IPC.exportSave, [...files], kind) as Promise<ExportResult>,
  },
  app: {
    licenses: () => ipcRenderer.invoke(IPC.appLicenses) as Promise<string>,
    onShowAbout: (listener) => {
      const handler = () => listener()
      ipcRenderer.on(IPC.appShowAbout, handler)
      return () => ipcRenderer.off(IPC.appShowAbout, handler)
    },
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<Settings>,
    set: (changes) => ipcRenderer.invoke(IPC.settingsSet, changes) as Promise<Settings>,
  },
  recovery: {
    write: (text) => ipcRenderer.invoke(IPC.recoveryWrite, text) as Promise<void>,
    take: () => ipcRenderer.invoke(IPC.recoveryTake) as Promise<RecoveredProject | null>,
    clear: () => ipcRenderer.invoke(IPC.recoveryClear) as Promise<void>,
  },
}

contextBridge.exposeInMainWorld('motif', api)
