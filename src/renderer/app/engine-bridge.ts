// Connects the stores to the audio engine. Lives in the app layer so that the engine never imports
// UI state (golden rule 2) and the stores never import the engine.
import { generateProjectCode } from '../codegen/generate'
import { evaluateNow, onEvaluation, setMaster, setProgram } from '../engine/engine'
import type { Project } from '../model/project'
import { codeStore } from '../store/code-store'
import { projectStore } from '../store/project-store'
import { transportStore, type TransportState } from '../store/transport-store'
import { playbackProgram } from './playback-program'

export function startEngineBridge(): () => void {
  let lastProject: Project | null = null
  let lastCode: string | null = null
  let lastPlayed: string | null = null
  let lastMaster: Project['master'] | null = null

  const sync = (project: Project, transport: TransportState) => {
    if (project !== lastProject) {
      lastProject = project
      if (project.master !== lastMaster) {
        lastMaster = project.master
        setMaster(lastMaster)
      }
    }
    let shown
    let played
    try {
      shown = generateProjectCode(project)
      played = playbackProgram(project, transport)
    } catch (error) {
      transportStore.getState().setErrors({}, error instanceof Error ? error.message : String(error))
      return
    }
    if (shown.code !== lastCode) {
      lastCode = shown.code
      codeStore.getState().setGenerated(shown)
    }
    if (played.code === lastPlayed) return
    lastPlayed = played.code
    setProgram(played)
    // A queued scene must be playing before its cycle starts: skip the debounce.
    if (transport.queued) void evaluateNow()
  }

  sync(projectStore.getState().project, transportStore.getState())
  const unsubscribeProject = projectStore.subscribe((state) => {
    sync(state.project, transportStore.getState())
  })
  const unsubscribeTransport = transportStore.subscribe((state, previous) => {
    if (
      state.arrangeMode !== previous.arrangeMode ||
      state.liveScene !== previous.liveScene ||
      state.queued !== previous.queued
    )
      sync(projectStore.getState().project, state)
  })
  const unsubscribeEngine = onEvaluation((result) => {
    transportStore.getState().setErrors(result.errors, result.globalError)
  })
  return () => {
    unsubscribeProject()
    unsubscribeTransport()
    unsubscribeEngine()
  }
}
