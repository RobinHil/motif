import { join } from 'node:path'
import { app, BrowserWindow, dialog, session } from 'electron'
import { APP_NAME } from '@shared/app-info'
import { registerProjectIpc } from './project-ipc'
import type { Recovery } from './recovery'
import { bundledSamplesRoot, handleSampleProtocol, registerSampleScheme } from './sample-protocol'
import { hardenSession, hardenWebContents } from './security'

const devServerUrl = !app.isPackaged ? (process.env['ELECTRON_RENDERER_URL'] ?? null) : null
const devServerOrigin = devServerUrl !== null ? new URL(devServerUrl).origin : null

let recovery: Recovery | null = null
let quitting = false

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
      // A music app: the engine may prepare audio before the first click.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  // The renderer blocks unloading while the project has unsaved changes.
  window.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question',
      title: APP_NAME,
      message: 'Quit without saving?',
      detail: 'Your latest changes are not saved.',
      buttons: ['Cancel', 'Quit without saving'],
      defaultId: 0,
      cancelId: 0,
    })
    if (choice === 1) event.preventDefault()
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
registerSampleScheme()
hardenWebContents(devServerOrigin)

void app.whenReady().then(async () => {
  hardenSession(session.defaultSession, devServerOrigin)
  handleSampleProtocol({ bundled: bundledSamplesRoot() })
  recovery = await registerProjectIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// A clean quit leaves nothing to recover. The lock file is removed last, after the windows closed.
app.on('will-quit', (event) => {
  if (quitting || recovery === null) return
  event.preventDefault()
  quitting = true
  void recovery.stop().finally(() => {
    app.quit()
  })
})
