import { uiStore, type Screen } from '../store/ui-store'
import { SCREEN_LABELS } from './TransportBar'

const PHASE: Record<Exclude<Screen, 'studio' | 'code' | 'mixer' | 'pianoroll'>, string> = {
  modulation: 'Modulation is on the way.',
  arrangement: 'Scenes and the arrangement are on the way.',
}

/** Screens that later phases build. Playback and editing keep working from the Studio. */
export function PlaceholderScreen({ screen }: { screen: Exclude<Screen, 'studio' | 'code' | 'mixer' | 'pianoroll'> }) {
  return (
    <main className="grid flex-1 place-items-center bg-bg-app p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-screen-title font-medium">{SCREEN_LABELS[screen]}</h1>
        <p className="text-body-lg text-text-2">{PHASE[screen]} The music keeps playing while you look around.</p>
        <button
          type="button"
          onClick={() => uiStore.getState().setScreen('studio')}
          className="h-10 rounded-pill border border-line-strong px-5 text-body text-text hover:bg-raised"
        >
          Back to the Studio
        </button>
      </div>
    </main>
  )
}
