import { useRef, type PointerEvent } from 'react'
import { STEPS_PER_CYCLE, type ID, type NoteContent, type TrackColor } from '../../model/project'
import { setNoteValues } from '../../store/note-actions'
import { projectStore } from '../../store/project-store'
import { pianoRollStore, usePianoRoll } from './piano-roll-store'

const FILL: Record<TrackColor, string> = {
  'track-1': 'bg-track-1',
  'track-2': 'bg-track-2',
  'track-3': 'bg-track-3',
  'track-4': 'bg-track-4',
}

/** Velocity lane under the roll: one bar per note, drag it up or down (SPEC 6.3). */
export function VelocityLane({ trackId, content, color }: { trackId: ID; content: NoteContent; color: TrackColor }) {
  const selection = usePianoRoll((s) => s.selection)
  const laneRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<ID[] | null>(null)
  const { update, beginGesture, endGesture } = projectStore.getState()

  const valueAt = (clientY: number) => {
    const rect = laneRef.current?.getBoundingClientRect()
    if (!rect) return 1
    return Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-velocity]')?.dataset['velocity']
    if (!id) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const ids = selection.includes(id) ? selection : [id]
    pianoRollStore.getState().set({ selection: ids })
    dragging.current = ids
    beginGesture()
    update(setNoteValues(trackId, ids, { velocity: valueAt(event.clientY) }))
  }

  return (
    <div className="grid grid-cols-[64px_1fr] border-t border-line">
      <span className="self-end pb-2 pl-2 text-small text-text-2">Velocity</span>
      <div
        ref={laneRef}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          if (dragging.current) update(setNoteValues(trackId, dragging.current, { velocity: valueAt(event.clientY) }))
        }}
        onPointerUp={() => {
          if (!dragging.current) return
          dragging.current = null
          endGesture()
        }}
        className="relative h-20 touch-none bg-bg-code"
      >
        {content.notes.map((note) => (
          <div
            key={note.id}
            data-velocity={note.id}
            role="img"
            aria-label={`Velocity ${String(note.velocity)}`}
            className={`absolute bottom-0 w-1.5 cursor-ns-resize rounded-t-xs ${FILL[color]} ${selection.includes(note.id) ? 'outline-1 outline-text' : ''}`}
            style={{
              left: `calc(${String((note.step / STEPS_PER_CYCLE) * 100)}% + 2px)`,
              height: `${String(Math.max(4, note.velocity * 100))}%`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
