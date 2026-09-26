import type { ReactNode } from 'react'
import { ROOTS, SCALE_TYPES } from '../../model/scales'
import type { ID } from '../../model/project'
import { addTrack } from '../../store/actions'
import { setNoteMode, setScale } from '../../store/note-actions'
import { projectStore, useProject } from '../../store/project-store'
import { midiStore, useMidi } from '../../store/midi-store'
import { uiStore, useUi } from '../../store/ui-store'
import { SWATCH } from '../studio/StudioTrackRow'
import { NotePanel } from './NotePanel'
import { GRIDS, pianoRollStore, usePianoRoll, type Tool } from './piano-roll-store'
import { RollGrid } from './RollGrid'
import { cycleCount } from './roll-geometry'
import { VelocityLane } from './VelocityLane'

const TOOLS: { tool: Tool; label: string; icon: ReactNode }[] = [
  {
    tool: 'pencil',
    label: 'Pencil: draw and move notes',
    icon: <path d="M3 13 L3.5 10.5 L10.5 3.5 L12.5 5.5 L5.5 12.5 Z M9.5 4.5 L11.5 6.5" />,
  },
  {
    tool: 'select',
    label: 'Select: drag a box around notes',
    icon: <rect x="3" y="3" width="10" height="10" strokeDasharray="2 2" />,
  },
  {
    tool: 'eraser',
    label: 'Eraser: click or drag over notes',
    icon: <path d="M6 13 H13 M3.5 9.5 L8.5 4.5 L12 8 L7.5 12.5 H5.5 Z" />,
  },
]

const SCALES = ROOTS.flatMap((root) =>
  SCALE_TYPES.map((t) => ({ value: `${root}:${t.name}`, label: `${root} ${t.label}` })),
)

/** Piano roll (SPEC 6.3, mockup 3-piano-roll.png). Edits the selected notes track. */
export function PianoRollScreen() {
  const selectedId = useUi((s) => s.selectedTrackId)
  const noteTracks = useProject((s) =>
    s.project.tracks
      .filter((t) => t.kind === 'notes')
      .map((t) => t.id)
      .join('\n'),
  )
  const ids = noteTracks ? noteTracks.split('\n') : []
  const trackId: ID | undefined = selectedId && ids.includes(selectedId) ? selectedId : ids[0]
  const track = useProject((s) => s.project.tracks.find((t) => t.id === trackId))
  const tool = usePianoRoll((s) => s.tool)
  const grid = usePianoRoll((s) => s.grid)
  const snap = usePianoRoll((s) => s.snapToScale)
  const cycle = usePianoRoll((s) => s.editCycle)
  const recording = useMidi((s) => s.recording)
  const set = pianoRollStore.getState().set
  const { update } = projectStore.getState()

  if (!track?.notes) {
    return (
      <main className="grid flex-1 place-items-center bg-bg-app">
        <div className="flex flex-col items-center gap-4">
          <p className="text-body-lg text-text-2">The piano roll edits a notes track. This project has none yet.</p>
          <button
            type="button"
            onClick={() => {
              const created = addTrack('notes')
              update(created.recipe)
              uiStore.getState().selectTrack(created.id)
            }}
            className="h-10 rounded-pill bg-accent px-5 text-body font-medium text-bg-app hover:bg-accent-hover"
          >
            Add a notes track
          </button>
        </div>
      </main>
    )
  }

  const content = track.notes
  const cycles = cycleCount(content)
  const scale = content.scale ?? 'C:minor'

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_330px] bg-bg-app">
      <h1 className="sr-only">Piano roll</h1>
      <section aria-label={`Piano roll of ${track.name}`} className="flex min-h-0 flex-col">
        <div
          role="toolbar"
          aria-label="Piano roll tools"
          className="flex items-center gap-3 overflow-x-auto border-b border-line px-5 py-2.5 whitespace-nowrap"
        >
          <span className={`size-3.5 rounded-xs ${SWATCH[track.color]}`} />
          {ids.length > 1 ? (
            <select
              aria-label="Notes track"
              value={track.id}
              onChange={(event) => {
                uiStore.getState().selectTrack(event.target.value)
                set({ selection: [], editCycle: 1 })
              }}
              className="bg-transparent text-track-name font-medium text-text outline-none"
            >
              {ids.map((id) => (
                <option key={id} value={id}>
                  {projectStore.getState().project.tracks.find((t) => t.id === id)?.name}
                </option>
              ))}
            </select>
          ) : (
            <h2 className="text-track-name font-medium">{track.name}</h2>
          )}
          <div role="group" aria-label="Mode" className="flex rounded-control bg-raised p-0.5 text-body">
            {(
              [
                ['note', 'Notes (note)'],
                ['degree', 'Scale degrees (n + scale)'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={content.mode === mode}
                onClick={() => update(setNoteMode(track.id, mode, scale))}
                className={`rounded-xs px-3 py-1 ${content.mode === mode ? 'bg-active text-text' : 'text-text-2 hover:text-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-body text-text-2">
            Scale
            <select
              value={content.scale ?? ''}
              title={content.scale ? `.scale("${content.scale}")` : 'No scale: notes are written by name'}
              onChange={(event) => update(setScale(track.id, event.target.value))}
              className="h-8 w-48 rounded-input border border-line-strong bg-bg-code px-2 text-body text-text outline-none"
            >
              {content.mode === 'note' && !content.scale && <option value="">None</option>}
              {SCALES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({s.value})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-body" title="Keep new and moved notes in the scale">
            <input
              type="checkbox"
              checked={content.mode === 'degree' || snap}
              disabled={content.mode === 'degree'}
              onChange={(event) => set({ snapToScale: event.target.checked })}
              className="size-4 accent-accent"
            />
            Snap to scale
          </label>
          <label className="flex items-center gap-2 text-body text-text-2">
            Grid
            <select
              value={grid}
              onChange={(event) => set({ grid: Number(event.target.value) })}
              className="h-8 w-20 rounded-input border border-line-strong bg-bg-code px-2 text-body text-text outline-none"
            >
              {GRIDS.map((g) => (
                <option key={g.label} value={g.steps}>
                  {g.label}
                </option>
              ))}
              <option disabled>Triplets (later)</option>
            </select>
          </label>
          <button
            type="button"
            aria-pressed={recording}
            onClick={() => midiStore.getState().setRecording(!recording)}
            title="Notes played on a MIDI keyboard are written here, on the grid: at the playhead while playing, at the cursor when stopped"
            className={`ml-auto flex h-9 items-center gap-2 rounded-control border px-3 text-body ${recording ? 'border-danger text-text' : 'border-line text-text-2 hover:text-text'}`}
          >
            <span className={`size-2.5 rounded-pill ${recording ? 'bg-danger' : 'bg-text-3'}`} />
            Record MIDI
          </button>
          <div role="group" aria-label="Tool" className="flex gap-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.tool}
                type="button"
                aria-label={t.label}
                title={t.label}
                aria-pressed={tool === t.tool}
                onClick={() => set({ tool: t.tool })}
                className={`grid size-9 place-items-center rounded-control border ${tool === t.tool ? 'border-text-2 bg-active text-text' : 'border-line text-text-2 hover:text-text'}`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-4 fill-none stroke-current"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                >
                  {t.icon}
                </svg>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <span className="text-body text-text-2">Edit cycle</span>
          {[...Array.from({ length: cycles }, (_, i) => i + 1), 'all' as const].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              title={
                c === 'all'
                  ? 'Edit every cycle at once'
                  : `Edit what plays on cycle ${String(c)}: a note that differs between cycles is written <a b>`
              }
              onClick={() => set({ editCycle: c })}
              className={`h-8 rounded-pill border px-3.5 text-body ${cycle === c ? 'border-text-2 text-text' : 'border-line text-text-2 hover:text-text'}`}
            >
              {c === 'all' ? 'All' : `Cycle ${String(c)}`}
            </button>
          ))}
          <span className="ml-2 text-body text-text-2">
            A note that changes from one cycle to the next becomes an alternation{' '}
            {content.mode === 'degree' ? '<5 7>' : '<c3 d3>'} in the code
          </span>
        </div>
        <RollGrid trackId={track.id} content={content} color={track.color} />
        <VelocityLane trackId={track.id} content={content} color={track.color} />
      </section>
      <NotePanel track={track} content={content} />
    </main>
  )
}
