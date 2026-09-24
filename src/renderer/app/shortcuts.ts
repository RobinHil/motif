// Global keyboard shortcuts (SPEC 10). Ctrl becomes Cmd on macOS.
import { duplicateTrack, setMute, setSolo } from '../store/actions'
import { projectStore } from '../store/project-store'
import { SCREENS, uiStore } from '../store/ui-store'
import { newProject, openProject, saveProject, saveProjectAs } from './project-session'
import { evaluateDraft } from './direct-edit'
import { panicAll, togglePlay } from './transport'

export const IS_MAC = navigator.userAgent.includes('Mac')
export const MOD = IS_MAC ? 'Cmd' : 'Ctrl'

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space', action: 'Play / stop' },
  { keys: `${MOD}+.`, action: 'Panic (stop everything)' },
  { keys: `${MOD}+Enter`, action: 'Evaluate code' },
  { keys: `${MOD}+Z / ${MOD}+Shift+Z`, action: 'Undo / redo' },
  { keys: `${MOD}+S / ${MOD}+O / ${MOD}+N`, action: 'Save / open / new project' },
  { keys: `${MOD}+Shift+S`, action: 'Save as' },
  { keys: '1 to 6', action: 'Switch screen' },
  { keys: 'M / S', action: 'Mute / solo selected track' },
  { keys: `${MOD}+D`, action: 'Duplicate track' },
  { keys: '?', action: 'Shortcut help' },
  { keys: `${MOD}+,`, action: 'Settings' },
]

/** Typing in a field (or in the code editor, inside its shadow root) keeps single-key shortcuts off. */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.composedPath()[0]
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function run(event: KeyboardEvent, action: () => unknown) {
  event.preventDefault()
  void action()
}

export function handleShortcut(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.repeat) return
  const mod = IS_MAC ? event.metaKey : event.ctrlKey
  const key = event.key.toLowerCase()
  const project = projectStore.getState()
  const selected = uiStore.getState().selectedTrackId

  if (mod) {
    if (key === '.') run(event, panicAll)
    else if (key === 'enter') run(event, evaluateDraft)
    else if (key === 'z' && event.shiftKey) run(event, project.redo)
    else if (key === 'z' || (key === 'y' && !IS_MAC)) run(event, key === 'y' ? project.redo : project.undo)
    else if (key === 's') run(event, event.shiftKey ? saveProjectAs : saveProject)
    else if (key === 'o') run(event, openProject)
    else if (key === 'n') run(event, newProject)
    else if (key === ',') run(event, () => uiStore.getState().setScreen('settings'))
    else if (key === 'd' && selected) {
      run(event, () => {
        const copy = duplicateTrack(selected)
        project.update(copy.recipe)
        uiStore.getState().selectTrack(copy.id)
      })
    }
    return
  }
  if (isTyping(event) || event.altKey) return

  if (event.key === ' ') run(event, togglePlay)
  else if (event.key === '?') run(event, () => uiStore.getState().setHelpOpen(!uiStore.getState().helpOpen))
  else if (event.key === 'Escape' && uiStore.getState().helpOpen)
    run(event, () => uiStore.getState().setHelpOpen(false))
  else if (/^[1-6]$/.test(event.key)) {
    const screen = SCREENS[Number(event.key) - 1]
    if (screen) run(event, () => uiStore.getState().setScreen(screen))
  } else if ((key === 'm' || key === 's') && selected) {
    const track = project.project.tracks.find((t) => t.id === selected)
    if (!track) return
    run(event, () => project.update(key === 'm' ? setMute(selected, !track.mute) : setSolo(selected, !track.solo)))
  }
}

export function startShortcuts(): () => void {
  window.addEventListener('keydown', handleShortcut)
  return () => window.removeEventListener('keydown', handleShortcut)
}
