import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { APP_NAME } from '@shared/app-info'
import { IPC, type OpenResult, type RecentProject, type RecoveredProject, type SaveResult } from '@shared/ipc'
import {
  assertProjectText,
  containsFreeCode,
  PROJECT_EXTENSION,
  projectNameFromDir,
  readProjectFolder,
  withProjectExtension,
  writeProjectFolder,
} from './project-files'
import { RecentProjects } from './recent-projects'
import { Recovery } from './recovery'
import { TrustedProjects } from './trusted-projects'

/** The folder the current project lives in. Only ever set from a dialog or from the recovery file. */
let currentDir: string | null = null

function sanitizeName(value: unknown): string {
  const text = typeof value === 'string' ? value : ''
  // Code units are enough here: only ASCII control and path characters are removed.
  const name = Array.from({ length: text.length }, (_, i) => text.charAt(i))
    .filter((char) => char.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(char))
    .join('')
    .trim()
  return name.slice(0, 100) || 'Untitled'
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function windowOf(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined
}

async function confirmFreeCode(window: BrowserWindow | undefined, name: string): Promise<boolean> {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    title: APP_NAME,
    message: `"${name}" contains free code`,
    detail:
      'Strudel code is JavaScript that runs on your computer. Open this project only if you trust the person who made it.',
    buttons: ['Cancel', 'Open anyway'],
    defaultId: 0,
    cancelId: 0,
  }
  const { response } = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options)
  return response === 1
}

export async function registerProjectIpc(): Promise<Recovery> {
  const userData = app.getPath('userData')
  const recovery = new Recovery(join(userData, 'recovery'))
  const trusted = new TrustedProjects(join(userData, 'trusted-projects.json'))
  const recent = new RecentProjects(join(userData, 'recent-projects.json'))
  await recovery.start()

  /** Reads a project folder, warning before running someone else's free code. */
  async function openDir(window: BrowserWindow | undefined, dir: string): Promise<OpenResult> {
    const text = await readProjectFolder(dir)
    const name = projectNameFromDir(dir)
    if (containsFreeCode(text) && !(await trusted.isTrusted(dir)) && !(await confirmFreeCode(window, name))) {
      return { status: 'canceled' }
    }
    currentDir = dir
    await recent.add(dir)
    return { status: 'opened', text, name }
  }

  async function saveTo(dir: string, text: string): Promise<SaveResult> {
    await writeProjectFolder(dir, text)
    currentDir = dir
    await trusted.trust(dir)
    await recent.add(dir)
    await recovery.clear()
    return { status: 'saved', name: projectNameFromDir(dir) }
  }

  async function saveAs(event: IpcMainInvokeEvent, text: string, suggestedName: unknown): Promise<SaveResult> {
    const window = windowOf(event)
    const options: Electron.SaveDialogOptions = {
      title: 'Save project',
      defaultPath: join(app.getPath('music'), `${sanitizeName(suggestedName)}${PROJECT_EXTENSION}`),
      buttonLabel: 'Save',
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { status: 'canceled' }
    return saveTo(withProjectExtension(result.filePath), text)
  }

  ipcMain.handle(IPC.projectOpen, async (event): Promise<OpenResult> => {
    try {
      const window = windowOf(event)
      const options: Electron.OpenDialogOptions = {
        title: 'Open project',
        buttonLabel: 'Open',
        properties: ['openDirectory', 'treatPackageAsDirectory'],
      }
      const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
      const dir = result.filePaths[0]
      if (result.canceled || dir === undefined) return { status: 'canceled' }
      return await openDir(window, dir)
    } catch (error) {
      return { status: 'error', message: message(error) }
    }
  })

  ipcMain.handle(IPC.projectSave, async (event, text: unknown, suggestedName: unknown): Promise<SaveResult> => {
    try {
      assertProjectText(text)
      return currentDir === null ? await saveAs(event, text, suggestedName) : await saveTo(currentDir, text)
    } catch (error) {
      return { status: 'error', message: message(error) }
    }
  })

  ipcMain.handle(IPC.projectSaveAs, async (event, text: unknown, suggestedName: unknown): Promise<SaveResult> => {
    try {
      assertProjectText(text)
      return await saveAs(event, text, suggestedName)
    } catch (error) {
      return { status: 'error', message: message(error) }
    }
  })

  ipcMain.handle(IPC.projectNew, () => {
    currentDir = null
  })

  ipcMain.handle(IPC.projectRecent, (): Promise<RecentProject[]> => recent.list())

  ipcMain.handle(IPC.projectOpenRecent, async (event, id: unknown): Promise<OpenResult> => {
    const dir = await recent.resolve(id)
    if (dir === null) return { status: 'error', message: 'This project is no longer in the recent list.' }
    try {
      return await openDir(windowOf(event), dir)
    } catch (error) {
      await recent.remove(dir)
      return { status: 'error', message: message(error) }
    }
  })

  ipcMain.handle(IPC.recoveryWrite, async (_event, text: unknown) => {
    assertProjectText(text)
    await recovery.write(text, currentDir)
  })

  ipcMain.handle(IPC.recoveryTake, async (): Promise<RecoveredProject | null> => {
    const data = await recovery.read()
    if (data === null) return null
    currentDir = data.projectDir
    return {
      text: data.text,
      name: data.projectDir ? projectNameFromDir(data.projectDir) : null,
      savedAt: data.savedAt,
    }
  })

  ipcMain.handle(IPC.recoveryClear, () => recovery.clear())

  return recovery
}
