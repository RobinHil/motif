import { useEffect, useState } from 'react'
import lockup from '../../../resources/brand/lockup-tagline.svg'
import type { RecentProject } from '@shared/ipc'
import { uiStore } from '../store/ui-store'
import { newProject, openDemo, openProject, openRecentProject } from './project-session'
import { startTutorial } from './tutorial-session'

const ACTIONS = [
  { label: 'New project', hint: 'Ctrl+N', run: newProject },
  { label: 'Open', hint: 'Ctrl+O', run: openProject },
  { label: 'Demo', hint: 'Drums, Bass, Lead, Texture', run: openDemo },
  { label: 'Tutorial', hint: 'Build a tek track step by step', run: startTutorial },
]

/** Home screen (SPEC 10, onboarding): logo lockup, new, open, recent projects, demo. */
export function HomeScreen() {
  const [recent, setRecent] = useState<RecentProject[] | null>(null)

  useEffect(() => {
    void window.motif.project.recent().then(setRecent)
  }, [])

  const go = async (run: () => Promise<void>) => {
    await run()
    uiStore.getState().setScreen('studio')
  }

  return (
    <main className="grid flex-1 place-items-center overflow-y-auto bg-bg-app p-8">
      <div className="flex w-full max-w-xl flex-col gap-10">
        <h1>
          <img src={lockup} alt="Motif, powered by Strudel" className="h-12" />
        </h1>
        <div className="flex flex-wrap gap-3">
          {ACTIONS.map((action, index) => (
            <button
              key={action.label}
              type="button"
              onClick={() => void go(action.run)}
              title={action.hint}
              className={`h-11 rounded-pill px-6 text-body-lg font-medium ${index === 0 ? 'bg-accent text-bg-app hover:bg-accent-hover' : 'border border-line-strong text-text hover:bg-raised'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
        <section aria-labelledby="recent-title" className="flex flex-col gap-3">
          <h2 id="recent-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
            Recent projects
          </h2>
          {recent === null ? null : recent.length === 0 ? (
            <p className="text-body text-text-2">Projects you save or open appear here.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => void openRecentProject(project.id)}
                    className="flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-body-lg text-text hover:bg-raised"
                  >
                    {project.name}
                    <span className="font-mono text-knob-value text-text-2">.motif</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
