import { useEffect } from 'react'
import { CodeScreen } from '../screens/code/CodeScreen'
import { MixerScreen } from '../screens/mixer/MixerScreen'
import { PianoRollScreen } from '../screens/pianoroll/PianoRollScreen'
import { StudioScreen } from '../screens/studio/StudioScreen'
import { projectStore } from '../store/project-store'
import { uiStore, useUi } from '../store/ui-store'
import { ConversionDialog } from './ConversionDialog'
import { HomeScreen } from './HomeScreen'
import { PlaceholderScreen } from './PlaceholderScreen'
import { ShortcutHelp } from './ShortcutHelp'
import { TransportBar } from './TransportBar'

function Notice() {
  const notice = useUi((s) => s.notice)
  if (!notice) return null
  return (
    <p role="status" className="flex items-center gap-3 border-b border-line bg-panel px-6 py-2 text-body text-text-2">
      {notice}
      <button type="button" onClick={() => uiStore.getState().setNotice(null)} className="text-text hover:text-accent">
        Dismiss
      </button>
    </p>
  )
}

/** App shell: transport bar, then the home screen or one of the six screens (SPEC 6). */
export function App() {
  const home = useUi((s) => s.home)
  const screen = useUi((s) => s.screen)

  // Keep a track selected so the inspector always has something to show.
  useEffect(
    () =>
      projectStore.subscribe((state) => {
        const { selectedTrackId, selectTrack } = uiStore.getState()
        if (!state.project.tracks.some((t) => t.id === selectedTrackId))
          selectTrack(state.project.tracks[0]?.id ?? null)
      }),
    [],
  )

  return (
    <div className="flex h-full flex-col bg-bg-app">
      <TransportBar />
      <Notice />
      {home ? (
        <HomeScreen />
      ) : screen === 'studio' ? (
        <StudioScreen />
      ) : screen === 'code' ? (
        <CodeScreen />
      ) : screen === 'mixer' ? (
        <MixerScreen />
      ) : screen === 'pianoroll' ? (
        <PianoRollScreen />
      ) : (
        <PlaceholderScreen screen={screen} />
      )}
      <ShortcutHelp />
      <ConversionDialog />
    </div>
  )
}
