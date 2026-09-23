import { useProject } from '../store/project-store'
import { useUi } from '../store/ui-store'
import { CodePanel } from './CodePanel'
import { TrackRow } from './TrackRow'
import { TransportControls } from './TransportControls'

/** Phase 1 shell: exercises the model, code generation, stores and engine. The studio comes in phase 2. */
export function App() {
  const trackIds = useProject((s) => s.project.tracks.map((t) => t.id).join('\n'))
  const notice = useUi((s) => s.notice)

  return (
    <div className="flex h-full flex-col bg-bg-app">
      <TransportControls />
      {notice && (
        <p role="status" className="border-b border-line bg-panel px-5 py-2 text-small text-text-2">
          {notice}
        </p>
      )}
      <main className="grid flex-1 grid-cols-[minmax(320px,1fr)_2fr] gap-4 overflow-auto p-5">
        <ul className="flex flex-col gap-3" aria-label="Tracks">
          {trackIds
            .split('\n')
            .filter(Boolean)
            .map((id) => (
              <TrackRow key={id} trackId={id} />
            ))}
        </ul>
        <CodePanel />
      </main>
    </div>
  )
}
