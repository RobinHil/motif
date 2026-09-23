import { join } from 'node:path'
import { app, BrowserWindow, session } from 'electron'
import { APP_NAME } from '@shared/app-info'
import { hardenSession, hardenWebContents } from './security'

const devServerUrl = !app.isPackaged ? (process.env['ELECTRON_RENDERER_URL'] ?? null) : null
const devServerOrigin = devServerUrl !== null ? new URL(devServerUrl).origin : null

function createWindow(): void {
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#08080A',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  if (!app.isPackaged) {
    window.webContents.on('console-message', ({ level, message }) => {
      console.log(`[renderer:${level}] ${message}`)
    })
  }

  if (devServerUrl !== null) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName(APP_NAME)
hardenWebContents(devServerOrigin)

void app.whenReady().then(() => {
  hardenSession(session.defaultSession, devServerOrigin)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
