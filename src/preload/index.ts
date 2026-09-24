import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  IPC,
  type MotifApi,
  type ImportResult,
  type LibrarySound,
  type OpenResult,
  type RecentProject,
  type RecoveredProject,
  type SaveResult,
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
  },
  recovery: {
    write: (text) => ipcRenderer.invoke(IPC.recoveryWrite, text) as Promise<void>,
    take: () => ipcRenderer.invoke(IPC.recoveryTake) as Promise<RecoveredProject | null>,
    clear: () => ipcRenderer.invoke(IPC.recoveryClear) as Promise<void>,
  },
}

contextBridge.exposeInMainWorld('motif', api)
