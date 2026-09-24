import { useState, type DragEvent, type KeyboardEvent } from 'react'
import { carries, dragTrack, readDrop } from '../../app/drag-data'
import { ContextMenu, type MenuPosition } from '../../components/ContextMenu'
import { TRACK_COLORS, type ID, type TrackColor, type TrackKind } from '../../model/project'
import {
  convertToFreeCode,
  dropOnTrack,
  duplicateTrack,
  moveTrack,
  removeTrack,
  renameTrack,
  setMute,
  setSolo,
  setTrackColor,
} from '../../store/actions'
import { projectStore, useProject } from '../../store/project-store'
import { useTransport } from '../../store/transport-store'
import { uiStore, useUi } from '../../store/ui-store'
import { TrackMeter } from '../../viz/TrackMeter'
import { FreeCodePreview } from './FreeCodePreview'
import { NotePreview } from './NotePreview'
import { StepGrid } from './StepGrid'

export const KIND_LABEL: Record<TrackKind, string> = { steps: 'Rhythm', notes: 'Notes', code: 'Free code' }

export const SWATCH: Record<TrackColor, string> = {
  'track-1': 'bg-track-1',
  'track-2': 'bg-track-2',
  'track-3': 'bg-track-3',
  'track-4': 'bg-track-4',
}

const NAME_COLOR: Record<TrackColor, string> = {
  'track-1': 'text-track-1',
  'track-2': 'text-track-2',
  'track-3': 'text-track-3',
  'track-4': 'text-track-4',
}

function SquareToggle(props: {
  label: string
  letter: string
  code: string
  active: boolean
  tone: 'danger' | 'accent'
  onToggle: () => void
}) {
  const on = props.tone === 'danger' ? 'border-danger text-danger' : 'border-accent text-accent'
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      title={`${props.label} (${props.code})`}
      onClick={props.onToggle}
      className={`size-8 rounded-control border text-body ${props.active ? on : 'border-line-strong text-text-2 hover:text-text'}`}
    >
      {props.letter}
    </button>
  )
}

/** One track in the Studio track list. Selects only its own fields (golden rule 4). */
export function StudioTrackRow({ trackId, index }: { trackId: ID; index: number }) {
  const name = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.name)
  const kind = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.kind)
  const orbit = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.orbit ?? 0)
  const color = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.color ?? 'track-1')
  const mute = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.mute ?? false)
  const solo = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.solo ?? false)
  const error = useTransport((s) => s.errors[trackId])
  const selected = useUi((s) => s.selectedTrackId === trackId)
  const [renaming, setRenaming] = useState(false)
  const [menu, setMenu] = useState<MenuPosition | null>(null)
  const [dropping, setDropping] = useState(false)

  if (name === undefined || kind === undefined) return null
  const { update } = projectStore.getState()
  const select = () => uiStore.getState().selectTrack(trackId)

  const onDrop = (event: DragEvent) => {
    setDropping(false)
    const dropped = readDrop(event)
    if (!dropped) return
    event.preventDefault()
    if (dropped.kind === 'track') {
      if (dropped.trackId !== trackId) update(moveTrack(dropped.trackId, index))
      return
    }
    update(
      dropOnTrack(
        trackId,
        dropped.kind === 'bank'
          ? { kind: 'bank', bank: dropped.bank }
          : { kind: 'sound', name: dropped.sound.name, category: dropped.sound.category },
      ),
    )
    select()
  }

  const onNameKeyDown = (event: KeyboardEvent) => {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      update(moveTrack(trackId, index + (event.key === 'ArrowUp' ? -1 : 1)))
    } else if (event.key === 'F2') {
      event.preventDefault()
      setRenaming(true)
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      setMenu({ x: rect.left, y: rect.bottom + 4 })
    }
  }

  return (
    <li
      aria-label={`${name}, ${KIND_LABEL[kind]}, orbit ${String(orbit)}`}
      onPointerDown={select}
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).closest('[role="grid"], [role="menu"]')) return
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY })
      }}
      onDragOver={(event) => {
        if (!carries(event, 'sound', 'bank', 'track')) return
        event.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false)
      }}
      onDrop={onDrop}
      className={`grid grid-cols-[196px_1fr] border-b border-line ${selected ? 'bg-selected-row' : ''} ${dropping ? 'outline-2 -outline-offset-2 outline-line-strong' : ''}`}
    >
      <div
        draggable={!renaming}
        onDragStart={(event) => dragTrack(event, trackId)}
        className="flex flex-col gap-3 border-r border-line px-4 py-4"
      >
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 size-3.5 shrink-0 rounded-xs ${SWATCH[color]}`} />
          <div className="flex min-w-0 flex-col">
            {renaming ? (
              <input
                autoFocus
                aria-label="Track name"
                defaultValue={name}
                onBlur={(event) => {
                  update(renameTrack(trackId, event.target.value))
                  setRenaming(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setRenaming(false)
                }}
                className="w-32 rounded-xs bg-bg-code px-1 text-track-name text-text outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={select}
                onDoubleClick={() => setRenaming(true)}
                onKeyDown={onNameKeyDown}
                title="Double-click or F2 to rename, Alt+arrows to move, Shift+F10 for the menu"
                className={`truncate text-left text-track-name font-medium ${selected ? NAME_COLOR[color] : 'text-text'}`}
              >
                {name}
              </button>
            )}
            <span className="text-small text-text-2">
              {KIND_LABEL[kind]} · orbit {orbit}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SquareToggle
            label="Mute"
            letter="M"
            code="_$:"
            tone="danger"
            active={mute}
            onToggle={() => update(setMute(trackId, !mute))}
          />
          <SquareToggle
            label="Solo"
            letter="S"
            code="_$: on the other tracks"
            tone="accent"
            active={solo}
            onToggle={() => update(setSolo(trackId, !solo))}
          />
          <TrackMeter orbit={orbit} label={name} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-2 px-5 py-4">
        {kind === 'steps' && <StepGrid trackId={trackId} color={color} />}
        {kind === 'notes' && <NotePreview trackId={trackId} color={color} />}
        {kind === 'code' && <FreeCodePreview trackId={trackId} />}
        {error && (
          <p role="alert" className="text-small text-danger">
            {error.message}
            {error.line !== undefined && ` (line ${String(error.line)})`}. Other tracks keep playing.
          </p>
        )}
      </div>
      {menu && (
        <ContextMenu
          label={`${name} menu`}
          position={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Duplicate', code: 'Ctrl+D', onSelect: () => update(duplicateTrack(trackId).recipe) },
            {
              label: 'Convert to free code',
              code: '$:',
              disabled: kind === 'code',
              onSelect: () => update(convertToFreeCode(trackId)),
            },
            ...TRACK_COLORS.filter((c) => c !== color).map((c) => ({
              label: `Color ${String(TRACK_COLORS.indexOf(c) + 1)}`,
              swatch: SWATCH[c],
              onSelect: () => update(setTrackColor(trackId, c)),
            })),
            {
              label: 'Delete',
              onSelect: () => {
                update(removeTrack(trackId))
                if (uiStore.getState().selectedTrackId === trackId) uiStore.getState().selectTrack(null)
              },
            },
          ]}
        />
      )}
    </li>
  )
}
