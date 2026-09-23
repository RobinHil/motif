import { CodePanel } from './CodePanel'
import { Inspector } from './Inspector'
import { SoundBrowser } from './SoundBrowser'
import { TracksPanel } from './TracksPanel'

/** Main screen (SPEC 6.1, mockup 1-studio.png): browser, tracks and code, inspector. */
export function StudioScreen() {
  return (
    <main className="grid min-h-0 flex-1 grid-cols-[264px_minmax(0,1fr)_340px] bg-bg-app">
      <SoundBrowser />
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(200px,34%)]">
        <TracksPanel />
        <CodePanel />
      </div>
      <Inspector />
    </main>
  )
}
