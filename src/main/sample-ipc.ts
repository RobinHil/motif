import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC, type ImportResult, type LibrarySound } from '@shared/ipc'
import { AUDIO_EXTENSIONS, BUILT_IN_SOUNDS } from '@shared/samples'
import { MAX_IMPORT_FILES, SampleLibrary } from './sample-library'
import type { SampleRoots } from './sample-path'
import { writeFileAtomic } from './project-files'
import { bundledSamplesRoot } from './sample-protocol'

/** Folders served by `motif-sample://<root>/`. `project` exists while the project has a folder. */
const roots: Record<string, string> = {}

export function sampleRoots(): SampleRoots {
  return roots
}

/** The current project folder's `samples/`, or null for a project that was never saved. */
export function setProjectSamplesDir(dir: string | null): void {
  if (dir === null) delete roots['project']
  else roots['project'] = dir
}

/** Every sound name of the bundled packs, read from their Strudel manifests. */
async function bundledNames(root: string): Promise<string[]> {
  const names: string[] = []
  for (const pack of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!pack.isDirectory()) continue
    try {
      const manifest = JSON.parse(await readFile(join(root, pack.name, 'strudel.json'), 'utf8')) as Record<
        string,
        unknown
      >
      names.push(...Object.keys(manifest).filter((key) => !key.startsWith('_')))
    } catch {
      // A folder without a manifest is not a pack.
    }
  }
  return names
}

function stringArray(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  return value.every((v) => typeof v === 'string' && v.length > 0 && v.length < 4096) ? (value as string[]) : null
}

/** A library folder the user chose (settings), kept outside the profile's own folder. */
async function chosenFolder(file: string): Promise<string | null> {
  try {
    const folder: unknown = JSON.parse(await readFile(file, 'utf8'))
    return typeof folder === 'string' && folder.length > 0 ? folder : null
  } catch {
    return null
  }
}

export async function registerSampleIpc(): Promise<SampleLibrary> {
  const locationFile = join(app.getPath('userData'), 'library-location.json')
  roots['bundled'] = bundledSamplesRoot()
  roots['library'] = (await chosenFolder(locationFile)) ?? join(app.getPath('userData'), 'sample-library')
  const library = new SampleLibrary(
    roots['library'],
    new Set([...BUILT_IN_SOUNDS, ...(await bundledNames(roots['bundled']))]),
  )

  ipcMain.handle(IPC.samplesLibrary, (): Promise<LibrarySound[]> => library.list())

  // Paths only come from the preload, which reads them from dropped File objects.
  ipcMain.handle(IPC.samplesImport, async (_event, paths: unknown): Promise<ImportResult> => {
    const valid = stringArray(paths, MAX_IMPORT_FILES)
    if (valid === null) return { added: [], rejected: [] }
    return library.import(valid)
  })

  ipcMain.handle(IPC.samplesImportDialog, async (event, kind: unknown): Promise<ImportResult | null> => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const folder = kind === 'folder'
    const options: Electron.OpenDialogOptions = {
      title: folder ? 'Import a sample folder' : 'Import samples',
      buttonLabel: 'Import',
      properties: folder ? ['openDirectory', 'multiSelections'] : ['openFile', 'multiSelections'],
      ...(folder ? {} : { filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS.map((e) => e.slice(1)) }] }),
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return library.import(result.filePaths)
  })

  ipcMain.handle(IPC.samplesRemoveFiles, async (_event, name: unknown, files: unknown) => {
    const valid = stringArray(files, MAX_IMPORT_FILES)
    if (typeof name !== 'string' || valid === null) return
    await library.removeFiles(name, valid)
  })

  ipcMain.handle(IPC.samplesRemove, async (_event, name: unknown) => {
    if (typeof name === 'string') await library.remove(name)
  })

  ipcMain.handle(IPC.samplesFolder, () => library.root)

  ipcMain.handle(IPC.samplesMoveFolder, async (event): Promise<string | null> => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options: Electron.OpenDialogOptions = {
      title: 'Choose the sample library folder',
      buttonLabel: 'Use this folder',
      properties: ['openDirectory', 'createDirectory'],
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    const folder = result.filePaths[0]
    if (result.canceled || folder === undefined) return null
    await library.moveTo(folder)
    roots['library'] = library.root
    await writeFileAtomic(locationFile, JSON.stringify(library.root))
    return library.root
  })

  ipcMain.handle(IPC.samplesShowFolder, async () => {
    await shell.openPath(library.root)
  })

  return library
}
