import { useState } from 'react'
import { ContextMenu, type MenuPosition } from '../../components/ContextMenu'
import type { TrackKind } from '../../model/project'
import { addTrack } from '../../store/actions'
import { projectStore, useProject } from '../../store/project-store'
import { uiStore } from '../../store/ui-store'
import { StudioTrackRow } from './StudioTrackRow'

const NEW_TRACKS: { kind: TrackKind; label: string; code: string }[] = [
  { kind: 'steps', label: 'Rhythm', code: 's("bd ~ sd ~")' },
  { kind: 'notes', label: 'Notes', code: 'note("c3 e3 g3")' },
  { kind: 'code', label: 'Free code', code: '$: ...' },
]

export function TracksPanel() {
  // A string key keeps this selector stable while tracks are edited but not added or moved.
  const trackIds = useProject((s) => s.project.tracks.map((t) => t.id).join('\n'))
  const [menu, setMenu] = useState<MenuPosition | null>(null)
  const ids = trackIds === '' ? [] : trackIds.split('\n')

  const create = (kind: TrackKind) => {
    const { id, recipe } = addTrack(kind)
    projectStore.getState().update(recipe)
    uiStore.getState().selectTrack(id)
  }

  return (
    <section aria-labelledby="tracks-title" className="flex min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <h2 id="tracks-title" className="text-track-name font-medium">
          Tracks
        </h2>
        <span className="text-body text-text-2">Click the steps to compose, the code updates below</span>
        <button
          type="button"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            setMenu({ x: rect.left, y: rect.bottom + 4 })
          }}
          className="ml-auto h-9 rounded-input border border-line-strong px-4 text-body text-text hover:bg-raised"
        >
          + Add track
        </button>
      </header>
      <ul aria-label="Tracks" className="min-h-0 flex-1 overflow-y-auto">
        {ids.map((id, index) => (
          <StudioTrackRow key={id} trackId={id} index={index} />
        ))}
        {ids.length === 0 && (
          <li className="px-5 py-8 text-body text-text-2">No track yet. Add a rhythm, notes or free code.</li>
        )}
      </ul>
      {menu && (
        <ContextMenu
          label="Add a track"
          position={menu}
          onClose={() => setMenu(null)}
          items={NEW_TRACKS.map((item) => ({ label: item.label, code: item.code, onSelect: () => create(item.kind) }))}
        />
      )}
    </section>
  )
}
