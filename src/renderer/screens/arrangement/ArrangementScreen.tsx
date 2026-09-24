import { captureScene } from '../../store/arrangement-actions'
import { projectStore, useProject } from '../../store/project-store'
import { transportStore, useTransport, type ArrangeMode } from '../../store/transport-store'
import { SceneCard } from './SceneCard'
import { SongCode } from './SongCode'
import { Timeline } from './Timeline'

const MODES: { mode: ArrangeMode; label: string; help: string }[] = [
  {
    mode: 'song',
    label: 'Song mode',
    help: 'In song mode, the sections play one after the other, then the song starts again',
  },
  { mode: 'live', label: 'Live mode', help: 'In live mode, clicking a scene starts it on the next cycle' },
]

/** Arrangement screen (SPEC 6.5, mockup 5-arrangement.png). */
export function ArrangementScreen() {
  const scenes = useProject((s) => s.project.scenes)
  const mode = useTransport((s) => s.arrangeMode)
  const liveScene = useTransport((s) => s.liveScene)
  const { setArrangeMode, setLiveScene } = transportStore.getState()

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-bg-app px-5 py-4 [&>*]:shrink-0">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-screen-title font-medium">Scenes</h1>
        <div role="group" aria-label="Arrangement mode" className="flex rounded-control bg-raised p-0.5 text-body">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              aria-pressed={mode === m.mode}
              onClick={() => setArrangeMode(m.mode)}
              className={`rounded-xs px-3.5 py-1.5 ${mode === m.mode ? 'bg-active text-accent' : 'text-text-2 hover:text-text'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-body text-text-2">{MODES.find((m) => m.mode === mode)?.help}</p>
        {mode === 'live' && liveScene !== null && (
          <button
            type="button"
            onClick={() => setLiveScene(null)}
            className="ml-auto rounded-pill border border-line-strong px-3 py-1 text-body text-text-2 hover:text-text"
          >
            Play every track
          </button>
        )}
      </header>
      <div role="list" aria-label="Scenes" className="flex gap-4 overflow-x-auto pb-1">
        {scenes.map((scene) => (
          <div role="listitem" key={scene.id} className="flex min-w-[170px] flex-1">
            <SceneCard scene={scene} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => projectStore.getState().update(captureScene().recipe)}
          title="A new scene with the tracks you hear now"
          className="grid h-[132px] min-w-[170px] flex-1 place-items-center rounded-panel border border-dashed border-line-strong text-body-lg text-text-2 hover:text-text"
        >
          + Capture current state
        </button>
      </div>
      <Timeline />
      <SongCode />
    </main>
  )
}
