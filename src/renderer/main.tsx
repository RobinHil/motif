import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { startEngineBridge } from './app/engine-bridge'
import { restoreRecovery, startAutosave } from './app/project-session'
import './styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

await restoreRecovery()
startEngineBridge()
startAutosave()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
