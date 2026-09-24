import { join } from 'node:path'
import { app, BrowserWindow, dialog, Menu, session } from 'electron'
import { APP_NAME } from '@shared/app-info'
import { IPC } from '@shared/ipc'
import { registerExportIpc } from './export-ipc'
import { projectArgument, registerProjectIpc, type ProjectIpc } from './project-ipc'
import type { Recovery } from './recovery'
import { registerSampleIpc, sampleRoots } from './sample-ipc'
import type { SettingsFile } from './settings'
import { registerSettingsIpc } from './settings-ipc'
import { handleSampleProtocol, registerSampleScheme } from './sample-protocol'
import { hardenSession, hardenWebContents } from './security'

const devServerUrl = !app.isPackaged ? (process.env['ELECTRON_RENDERER_URL'] ?? null) : null
const devServerOrigin = devServerUrl !== null ? new URL(devServerUrl).origin : null

let recovery: Recovery | null = null
let projects: ProjectIpc | null = null
/** A project the system asked to open before the app was ready (macOS open-file). */
let earlyOpen: string | null = null
let settings: SettingsFile | null = null
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
    // Linux window managers read the window icon; macOS and Windows use the bundle's.
    ...(process.platform === 'linux'
      ? {
          icon: app.isPackaged
            ? join(process.resourcesPath, 'icon.png')
            : join(app.getAppPath(), 'resources', 'brand', 'icons', '512x512.png'),
        }
      : {}),
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
  window.webContents.on('did-finish-load', () => {
    void settings?.get().then((s) => window.webContents.setZoomFactor(s.zoom))
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

/** macOS: the application menu (with About), Edit for copy and paste, and Window. Elsewhere: none. */
function setMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: APP_NAME,
        submenu: [
          {
            label: `About ${APP_NAME}`,
            click: () => BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.appShowAbout),
          },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ]),
  )
}

app.setName(APP_NAME)
// One Motif at a time: opening a project from the file manager goes to the running window.
if (!process.env['MOTIF_E2E_USER_DATA'] && !app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', (_event, argv) => {
  const dir = projectArgument(argv)
  const window = BrowserWindow.getAllWindows()[0]
  if (dir) projects?.openFromSystem(dir)
  else if (window) {
    if (window.isMinimized()) window.restore()
    window.focus()
  }
})
app.on('open-file', (event, path) => {
  event.preventDefault()
  if (projects) projects.openFromSystem(path)
  else earlyOpen = path
})
// End-to-end tests run each app in a fresh profile. Only the test launcher sets this variable.
const e2eUserData = process.env['MOTIF_E2E_USER_DATA']
if (e2eUserData) app.setPath('userData', e2eUserData)
registerSampleScheme()
hardenWebContents(devServerOrigin)

void app.whenReady().then(async () => {
  hardenSession(session.defaultSession, devServerOrigin)
  settings = await registerSettingsIpc()
  const library = await registerSampleIpc()
  handleSampleProtocol(sampleRoots)
  projects = await registerProjectIpc(library)
  recovery = projects.recovery
  setMenu()
  registerExportIpc()
  createWindow()
  const launchedWith = earlyOpen ?? projectArgument(process.argv)
  if (launchedWith) projects.openFromSystem(launchedWith)
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
