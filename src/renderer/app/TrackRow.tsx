import { setCode, setMute, setSolo } from '../store/actions'
import { projectStore, useProject } from '../store/project-store'
import { useTransport } from '../store/transport-store'
import type { ID } from '../model/project'

const COLOR_CLASS = {
  'track-1': 'bg-track-1',
  'track-2': 'bg-track-2',
  'track-3': 'bg-track-3',
  'track-4': 'bg-track-4',
} as const

function Toggle(props: {
  label: string
  code: string
  active: boolean
  tone: 'danger' | 'accent'
  onClick: () => void
}) {
  const active = props.tone === 'danger' ? 'bg-danger text-bg-app' : 'bg-accent text-bg-app'
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      title={`${props.label} (${props.code})`}
      onClick={props.onClick}
      className={`size-7 rounded-control text-small font-medium ${props.active ? active : 'bg-raised-2 text-text-2'}`}
    >
      {props.label[0]}
    </button>
  )
}

/** One track: selects only its own fields, so editing another track does not re-render it. */
export function TrackRow({ trackId }: { trackId: ID }) {
  const name = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.name)
  const kind = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.kind)
  const orbit = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.orbit)
  const color = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.color)
  const mute = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.mute ?? false)
  const solo = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.solo ?? false)
  const code = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.code)
  const error = useTransport((s) => s.errors[trackId])
  const { update, beginGesture, endGesture } = projectStore.getState()

  if (name === undefined) return null

  return (
    <li className="flex flex-col gap-2 rounded-panel bg-panel px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`size-3 rounded-xs ${color ? COLOR_CLASS[color] : ''}`} />
        <span className="text-track-name font-medium">{name}</span>
        <span className="text-small text-text-2">
          {kind} · orbit {orbit}
        </span>
        <span className="ml-auto flex gap-1">
          <Toggle
            label="Mute"
            code="_$:"
            tone="danger"
            active={mute}
            onClick={() => {
              update(setMute(trackId, !mute))
            }}
          />
          <Toggle
            label="Solo"
            code="_$: on the others"
            tone="accent"
            active={solo}
            onClick={() => {
              update(setSolo(trackId, !solo))
            }}
          />
        </span>
      </div>
      {kind === 'code' && (
        <label className="flex flex-col gap-1">
          <span className="text-section uppercase tracking-[0.14em] text-label">Free code</span>
          <textarea
            value={code ?? ''}
            spellCheck={false}
            rows={2}
            onFocus={beginGesture}
            onBlur={endGesture}
            onChange={(event) => {
              update(setCode(trackId, event.target.value))
            }}
            className="resize-y rounded-input border border-line bg-bg-code px-3 py-2 font-mono text-code text-text outline-none focus:border-line-strong"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-small text-danger">
          {error.message}
          {error.line !== undefined && ` (line ${String(error.line)})`}. Other tracks keep playing.
        </p>
      )}
    </li>
  )
}
