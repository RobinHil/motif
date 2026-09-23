import { STEPS_PER_CYCLE, type ID, type Note, type TrackColor } from '../../model/project'
import { noteNameToMidi } from '../../codegen/notes'
import { useProject } from '../../store/project-store'
import { uiStore } from '../../store/ui-store'

const STROKE: Record<TrackColor, string> = {
  'track-1': 'stroke-track-1',
  'track-2': 'stroke-track-2',
  'track-3': 'stroke-track-3',
  'track-4': 'stroke-track-4',
}

const pitchOf = (note: Note) => (typeof note.pitch === 'number' ? note.pitch : noteNameToMidi(note.pitch))

/** Mini piano roll of a notes track: one bar per note, higher notes higher. */
export function NotePreview({ trackId, color }: { trackId: ID; color: TrackColor }) {
  const content = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.notes)
  if (!content) return null
  const pitches = content.notes.map(pitchOf)
  const low = Math.min(...pitches)
  const high = Math.max(...pitches)
  const span = Math.max(1, high - low)
  const width = 640
  const height = 80
  const unit = width / STEPS_PER_CYCLE

  return (
    <div className="flex items-center gap-6">
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${String(content.notes.length)} notes`}
        className="h-[88px] flex-1 rounded-input border border-line bg-bg-code"
      >
        {content.notes.map((note) => {
          const y = content.notes.length > 0 ? 64 - ((pitchOf(note) - low) / span) * 48 : 40
          return (
            <line
              key={note.id}
              x1={note.step * unit + 6}
              x2={(note.step + note.length) * unit - 6}
              y1={y}
              y2={y}
              strokeWidth={6}
              strokeLinecap="round"
              className={STROKE[color]}
            />
          )
        })}
      </svg>
      <button
        type="button"
        onClick={() => {
          uiStore.getState().selectTrack(trackId)
          uiStore.getState().setScreen('pianoroll')
        }}
        className="w-24 text-left text-body text-accent hover:text-accent-hover"
      >
        Open piano roll →
      </button>
    </div>
  )
}
