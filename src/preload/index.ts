import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type MotifApi,
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
  recovery: {
    write: (text) => ipcRenderer.invoke(IPC.recoveryWrite, text) as Promise<void>,
    take: () => ipcRenderer.invoke(IPC.recoveryTake) as Promise<RecoveredProject | null>,
    clear: () => ipcRenderer.invoke(IPC.recoveryClear) as Promise<void>,
  },
}

contextBridge.exposeInMainWorld('motif', api)
