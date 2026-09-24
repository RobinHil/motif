import { join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC, type Settings } from '@shared/ipc'
import { SettingsFile } from './settings'

export async function registerSettingsIpc(): Promise<SettingsFile> {
  const settings = new SettingsFile(join(app.getPath('userData'), 'settings.json'))
  await settings.get()

  ipcMain.handle(IPC.settingsGet, (): Promise<Settings> => settings.get())

  ipcMain.handle(IPC.settingsSet, async (_event, changes: unknown): Promise<Settings> => {
    const next = await settings.update(changes)
    for (const window of BrowserWindow.getAllWindows()) window.webContents.setZoomFactor(next.zoom)
    return next
  })

  return settings
}
