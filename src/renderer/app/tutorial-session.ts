// Starting, following and finishing the tutorial (welcome banner). App layer: stores and IPC.
import { projectStore, selectIsDirty } from '../store/project-store'
import { transportStore } from '../store/transport-store'
import { tutorialStore } from '../store/tutorial-store'
import { uiStore } from '../store/ui-store'
import { TUTORIAL_STEPS } from '../tutorial/steps'
import { createTutorialStart } from '../tutorial/tracks'
import { changeSettings } from './settings-session'

/** Opens a new "Tutorial" project and shows the first step. Asks first if changes are unsaved. */
export async function startTutorial(): Promise<void> {
  if (
    selectIsDirty(projectStore.getState()) &&
    !window.confirm('Start the tutorial? Your unsaved changes will be lost.')
  )
    return
  await window.motif.project.reset()
  projectStore.getState().load(createTutorialStart(), { saved: true })
  uiStore.getState().setFileName(null)
  uiStore.getState().setNotice(null)
  uiStore.getState().setScreen('studio')
  transportStore.getState().setArrangeMode('live')
  transportStore.getState().setLiveScene(null)
  tutorialStore.getState().set({ active: true, step: 0 })
}

export function goToStep(step: number): void {
  const index = Math.max(0, Math.min(TUTORIAL_STEPS.length, step))
  tutorialStore.getState().set({ step: index })
  const screen = TUTORIAL_STEPS[index]?.screen
  if (screen) uiStore.getState().setScreen(screen)
}

/** "Do it for me": one undoable change. */
export function doCurrentStep(): void {
  const step = TUTORIAL_STEPS[tutorialStore.getState().step]
  if (step) projectStore.getState().update(step.apply)
}

/** The end: the song plays in song mode, and the invitation does not come back. */
export async function finishTutorial(): Promise<void> {
  tutorialStore.getState().set({ active: false, step: 0 })
  transportStore.getState().setArrangeMode('song')
  uiStore.getState().setScreen('arrangement')
  await changeSettings({ welcomeDismissed: true })
}

export function quitTutorial(): void {
  tutorialStore.getState().set({ active: false })
}

/** Closes the invitation for good. */
export function dismissWelcome(): Promise<void> {
  return changeSettings({ welcomeDismissed: true })
}
