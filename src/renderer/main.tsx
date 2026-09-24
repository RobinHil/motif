import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { startEngineBridge } from './app/engine-bridge'
import { startLiveScenes } from './app/live-scenes'
import { startLiveHighlight } from './app/live-highlight'
import { restoreRecovery, startAutosave, startSampleLibrary } from './app/project-session'
import { startShortcuts } from './app/shortcuts'
import { projectStore } from './store/project-store'
import { uiStore } from './store/ui-store'
import './styles/index.css'

const FIRST_LAUNCH_KEY = 'motif.launched'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

// First launch opens the demo in the Studio (SPEC 10); later launches start on the home screen.
const restored = await restoreRecovery()
let launchedBefore = false
try {
  launchedBefore = localStorage.getItem(FIRST_LAUNCH_KEY) !== null
  localStorage.setItem(FIRST_LAUNCH_KEY, '1')
} catch {
  // Storage unavailable: behave like a first launch.
}
uiStore.getState().setHome(launchedBefore && !restored)
uiStore.getState().selectTrack(projectStore.getState().project.tracks[0]?.id ?? null)

startEngineBridge()
startLiveScenes()
startLiveHighlight()
startAutosave()
startSampleLibrary()
startShortcuts()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
