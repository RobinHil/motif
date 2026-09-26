import { useProject } from '../../store/project-store'
import { ChannelStrip } from './ChannelStrip'
import { MasterStrip } from './MasterStrip'
import { OutputPanel } from './OutputPanel'

/** Mixer (SPEC 6.2, mockup 2-mixer.png): one strip per track, the master strip, the output panel. */
export function MixerScreen() {
  const trackIds = useProject((s) => s.project.tracks.map((t) => t.id).join('\n'))
  const ids = trackIds === '' ? [] : trackIds.split('\n')
  return (
    <main className="flex min-h-0 flex-1 gap-3 overflow-hidden bg-bg-app p-4">
      <h1 className="sr-only">Mixer</h1>
      <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1">
        {ids.map((id) => (
          <ChannelStrip key={id} trackId={id} />
        ))}
        <MasterStrip />
      </div>
      <OutputPanel />
    </main>
  )
}
