// Connects the stores to the audio engine. Lives in the app layer so that the engine never imports
// UI state (golden rule 2) and the stores never import the engine.
import { generateProjectCode } from '../codegen/generate'
import { onEvaluation, setMaster, setProgram } from '../engine/engine'
import type { Project } from '../model/project'
import { codeStore } from '../store/code-store'
import { projectStore } from '../store/project-store'
import { transportStore } from '../store/transport-store'

export function startEngineBridge(): () => void {
  let lastProject: Project | null = null
  let lastCode: string | null = null
  let lastMaster: Project['master'] | null = null

  const sync = (project: Project) => {
    if (project === lastProject) return
    lastProject = project
    if (project.master !== lastMaster) {
      lastMaster = project.master
      setMaster(lastMaster)
    }
    let generated
    try {
      generated = generateProjectCode(project)
    } catch (error) {
      transportStore.getState().setErrors({}, error instanceof Error ? error.message : String(error))
      return
    }
    if (generated.code === lastCode) return
    lastCode = generated.code
    codeStore.getState().setGenerated(generated)
    setProgram(generated)
  }

  sync(projectStore.getState().project)
  const unsubscribeProject = projectStore.subscribe((state) => {
    sync(state.project)
  })
  const unsubscribeEngine = onEvaluation((result) => {
    transportStore.getState().setErrors(result.errors, result.globalError)
  })
  return () => {
    unsubscribeProject()
    unsubscribeEngine()
  }
}
