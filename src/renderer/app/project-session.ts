// New, open, save and crash recovery, on top of the preload API and the project store.
import { createDemoProject } from '../model/demo'
import { createProject } from '../model/defaults'
import { migrateProject, ProjectLoadError, serializeProject } from '../model/migrations'
import { projectStore, selectIsDirty } from '../store/project-store'
import { uiStore } from '../store/ui-store'

/** SPEC 3: autosave every 30 seconds to a recovery file. */
export const AUTOSAVE_INTERVAL_MS = 30_000

function parseProject(text: string) {
  try {
    return migrateProject(JSON.parse(text))
  } catch (error) {
    if (error instanceof ProjectLoadError) throw error
    throw new ProjectLoadError('This project file is not valid JSON.')
  }
}

function notify(message: string | null) {
  uiStore.getState().setNotice(message)
}

export async function newProject(): Promise<void> {
  await window.motif.project.reset()
  projectStore.getState().load(createProject(), { saved: true })
  uiStore.getState().setFileName(null)
  notify(null)
}

export async function openDemo(): Promise<void> {
  await window.motif.project.reset()
  projectStore.getState().load(createDemoProject(), { saved: true })
  uiStore.getState().setFileName(null)
  notify(null)
}

export function openProject(): Promise<void> {
  return applyOpen(window.motif.project.open())
}

export function openRecentProject(id: string): Promise<void> {
  return applyOpen(window.motif.project.openRecent(id))
}

async function applyOpen(pending: ReturnType<typeof window.motif.project.open>): Promise<void> {
  const result = await pending
  if (result.status === 'canceled') return
  if (result.status === 'error') {
    notify(result.message)
    return
  }
  try {
    projectStore.getState().load(parseProject(result.text), { saved: true })
    uiStore.getState().setFileName(result.name)
    uiStore.getState().setScreen('studio')
    notify(null)
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error))
  }
}

async function save(saveAs: boolean): Promise<void> {
  const store = projectStore.getState()
  store.amend((project) => {
    project.meta.updatedAt = new Date().toISOString()
  })
  const { project } = projectStore.getState()
  const text = serializeProject(project)
  const api = window.motif.project
  const result = await (saveAs ? api.saveAs(text, project.meta.name) : api.save(text, project.meta.name))
  if (result.status === 'saved') {
    // Only mark saved if nothing changed while the file was being written.
    if (projectStore.getState().project === project) projectStore.getState().markSaved()
    uiStore.getState().setFileName(result.name)
    notify(null)
  } else if (result.status === 'error') {
    notify(`Could not save: ${result.message}`)
  }
}

export const saveProject = () => save(false)
export const saveProjectAs = () => save(true)

/** Restores the autosaved project after a crash. Returns whether one was restored. */
export async function restoreRecovery(): Promise<boolean> {
  const recovered = await window.motif.recovery.take()
  if (recovered === null) return false
  try {
    projectStore.getState().load(parseProject(recovered.text))
    uiStore.getState().setFileName(recovered.name)
    notify('Motif did not quit properly last time. Your project was restored from the last autosave.')
    return true
  } catch {
    await window.motif.recovery.clear()
    return false
  }
}

/** Autosaves unsaved changes every 30 seconds and guards the window against closing with them. */
export function startAutosave(): () => void {
  let lastWritten = projectStore.getState().project
  const timer = setInterval(() => {
    const state = projectStore.getState()
    if (!selectIsDirty(state) || state.project === lastWritten) return
    lastWritten = state.project
    void window.motif.recovery.write(serializeProject(state.project))
  }, AUTOSAVE_INTERVAL_MS)

  const guard = (event: BeforeUnloadEvent) => {
    if (selectIsDirty(projectStore.getState())) event.preventDefault()
  }
  window.addEventListener('beforeunload', guard)
  return () => {
    clearInterval(timer)
    window.removeEventListener('beforeunload', guard)
  }
}
