import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { getCycle, isPlaying } from '../../engine/engine'
import { STEPS_PER_CYCLE, type ID, type Note, type NoteContent, type TrackColor } from '../../model/project'
import { displayNoteName, inScale, midiToNoteName, snapToScale } from '../../model/scales'
import { addNote } from '../../store/actions'
import { deleteNotes, moveNotes, pasteNotes, pitchOnCycle, resizeNote } from '../../store/note-actions'
import { projectStore } from '../../store/project-store'
import { fitCanvas, onFrame, token } from '../../viz/frame-loop'
import { pianoRollStore, usePianoRoll } from './piano-roll-store'
import {
  contentScale,
  ghostMidis,
  HIGHEST,
  LOWEST,
  midiOfRow,
  noteMidi,
  pitchDelta,
  pitchForRow,
  ROW_HEIGHT,
  rowOf,
  ROWS,
} from './roll-geometry'

const FILL: Record<TrackColor, string> = {
  'track-1': 'bg-track-1',
  'track-2': 'bg-track-2',
  'track-3': 'bg-track-3',
  'track-4': 'bg-track-4',
}
const BORDER: Record<TrackColor, string> = {
  'track-1': 'border-track-1',
  'track-2': 'border-track-2',
  'track-3': 'border-track-3',
  'track-4': 'border-track-4',
}
const BLACK_KEYS = new Set([1, 3, 6, 8, 10])
const EDGE_PX = 7

type Drag =
  | { kind: 'move'; ids: ID[]; startStep: number; startMidi: number; appliedStep: number; appliedPitch: number }
  | { kind: 'resize'; id: ID; step: number }
  | { kind: 'draw'; id: ID; start: number }
  | { kind: 'erase' }
  | { kind: 'band'; x0: number; y0: number; x1: number; y1: number }

function RollPlayhead() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const color = token('text')
    let drawn = -1
    return onFrame(() => {
      const canvas = ref.current
      if (!canvas) return
      const phase = isPlaying() ? getCycle() % 1 : -1
      if (Math.abs(phase - drawn) < 0.001) return
      drawn = phase
      const context = fitCanvas(canvas)
      if (!context) return
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      if (phase < 0) return
      context.fillStyle = color
      context.fillRect(Math.round(phase * canvas.clientWidth), 0, 2, canvas.clientHeight)
    })
  }, [])
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
}

/** Piano roll editing area (SPEC 6.3): keyboard, rows, notes, ghosts of other cycles, playhead. */
export function RollGrid({ trackId, content, color }: { trackId: ID; content: NoteContent; color: TrackColor }) {
  const tool = usePianoRoll((s) => s.tool)
  const grid = usePianoRoll((s) => s.grid)
  const snap = usePianoRoll((s) => s.snapToScale)
  const cycle = usePianoRoll((s) => s.editCycle)
  const selection = usePianoRoll((s) => s.selection)
  const cursor = usePianoRoll((s) => s.cursor)
  const [band, setBand] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const scale = contentScale(content)
  const { update, beginGesture, endGesture } = projectStore.getState()
  const setRoll = pianoRollStore.getState().set

  // Start with the notes (or C3 to C5) in view.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const midis = content.notes.map((n) => noteMidi(n, cycle, scale))
    const center = midis.length > 0 ? (Math.max(...midis) + Math.min(...midis)) / 2 : 60
    scroller.scrollTop = rowOf(Math.round(center)) * ROW_HEIGHT - scroller.clientHeight / 2
    // Only on first display of a track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId])

  const locate = (clientX: number, clientY: number) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return { step: 0, midi: 60, x: 0, y: 0 }
    const x = clientX - rect.left
    const y = clientY - rect.top
    const step = Math.max(0, Math.min(STEPS_PER_CYCLE - 1, Math.floor((x / rect.width) * STEPS_PER_CYCLE)))
    const midi = Math.max(LOWEST, Math.min(HIGHEST, midiOfRow(Math.floor(y / ROW_HEIGHT))))
    return { step, midi, x, y }
  }

  const rowPitch = (midi: number) => {
    const target = content.mode === 'note' && snap && scale ? snapToScale(midi, scale) : midi
    return pitchForRow(target, content, scale)
  }

  const select = (ids: ID[]) => setRoll({ selection: ids })
  const notes = () => projectStore.getState().project.tracks.find((t) => t.id === trackId)?.notes?.notes ?? []

  const createAt = (step: number, midi: number): ID => {
    const start = Math.floor(step / grid) * grid
    const length = Math.min(grid, STEPS_PER_CYCLE - start)
    let created = ''
    update(
      addNote(trackId, { step: start, length, pitch: rowPitch(midi), velocity: 1, probability: 1 }, () => {
        created = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        return created
      }),
    )
    select([created])
    return created
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    areaRef.current?.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    const { step, midi, x, y } = locate(event.clientX, event.clientY)
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-note]')
    const noteId = target?.dataset['note'] ?? null
    const onEdge = target ? target.getBoundingClientRect().right - event.clientX <= EDGE_PX : false
    setRoll({ cursor: { step, midi } })

    if (tool === 'eraser') {
      beginGesture()
      if (noteId) update(deleteNotes(trackId, [noteId]))
      drag.current = { kind: 'erase' }
      return
    }
    if (noteId) {
      const ids = event.shiftKey
        ? selection.includes(noteId)
          ? selection.filter((id) => id !== noteId)
          : [...selection, noteId]
        : selection.includes(noteId)
          ? selection
          : [noteId]
      select(ids)
      beginGesture()
      const note = notes().find((n) => n.id === noteId)
      drag.current =
        onEdge && note
          ? { kind: 'resize', id: noteId, step: note.step }
          : { kind: 'move', ids, startStep: step, startMidi: midi, appliedStep: 0, appliedPitch: 0 }
      return
    }
    if (tool === 'select') {
      if (!event.shiftKey) select([])
      drag.current = { kind: 'band', x0: x, y0: y, x1: x, y1: y }
      setBand({ x0: x, y0: y, x1: x, y1: y })
      return
    }
    beginGesture()
    const id = createAt(step, midi)
    drag.current = { kind: 'draw', id, start: Math.floor(step / grid) * grid }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const { step, midi, x, y } = locate(event.clientX, event.clientY)
    if (d.kind === 'erase') {
      const noteId = (
        document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
      )?.closest<HTMLElement>('[data-note]')?.dataset['note']
      if (noteId) update(deleteNotes(trackId, [noteId]))
    } else if (d.kind === 'draw') {
      update(resizeNote(trackId, d.id, Math.max(grid, Math.ceil((step + 1 - d.start) / grid) * grid)))
    } else if (d.kind === 'resize') {
      update(resizeNote(trackId, d.id, Math.max(1, Math.round((step + 1 - d.step) / grid) * grid)))
    } else if (d.kind === 'move') {
      const wantStep = Math.round((step - d.startStep) / grid) * grid
      const wantPitch = pitchDelta(d.startMidi, midi, content, scale)
      if (wantStep !== d.appliedStep || wantPitch !== d.appliedPitch) {
        update(
          moveNotes(
            trackId,
            d.ids,
            wantStep - d.appliedStep,
            wantPitch - d.appliedPitch,
            cycle,
            content.mode === 'note' && snap ? scale : null,
          ),
        )
        d.appliedStep = wantStep
        d.appliedPitch = wantPitch
      }
    } else {
      d.x1 = x
      d.y1 = y
      setBand({ x0: d.x0, y0: d.y0, x1: x, y1: y })
    }
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.kind === 'band') {
      const rect = areaRef.current?.getBoundingClientRect()
      setBand(null)
      if (!rect) return
      const [left, right] = [Math.min(d.x0, d.x1), Math.max(d.x0, d.x1)]
      const [top, bottom] = [Math.min(d.y0, d.y1), Math.max(d.y0, d.y1)]
      const inside = notes().filter((n) => {
        const nx0 = (n.step / STEPS_PER_CYCLE) * rect.width
        const nx1 = ((n.step + n.length) / STEPS_PER_CYCLE) * rect.width
        const ny = rowOf(noteMidi(n, cycle, scale)) * ROW_HEIGHT
        return nx1 > left && nx0 < right && ny + ROW_HEIGHT > top && ny < bottom
      })
      select([...new Set([...selection, ...inside.map((n) => n.id)])])
      return
    }
    endGesture()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const mod = event.ctrlKey || event.metaKey
    const key = event.key
    const octave = content.mode === 'degree' && scale ? scale.intervals.length : 12
    if (mod && key.toLowerCase() === 'a') {
      event.preventDefault()
      select(notes().map((n) => n.id))
    } else if (mod && key.toLowerCase() === 'c') {
      event.preventDefault()
      setRoll({
        clipboard: notes()
          .filter((n) => selection.includes(n.id))
          .map((n) => structuredClone(n)),
      })
    } else if (mod && key.toLowerCase() === 'v') {
      event.preventDefault()
      const { clipboard } = pianoRollStore.getState()
      if (clipboard.length === 0) return
      const first = Math.min(...clipboard.map((n) => n.step))
      const chosen = notes().filter((n) => selection.includes(n.id))
      const offset = chosen.length > 0 ? Math.max(...chosen.map((n) => n.step + n.length)) - first : cursor.step - first
      const paste = pasteNotes(trackId, clipboard, offset)
      update(paste.recipe)
      select(paste.ids)
    } else if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault()
      if (selection.length > 0) update(deleteNotes(trackId, selection))
      select([])
    } else if (key === 'Escape') {
      select([])
    } else if (key === 'Enter') {
      event.preventDefault()
      createAt(cursor.step, cursor.midi)
    } else if (key.startsWith('Arrow')) {
      event.preventDefault()
      const horizontal = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0
      const vertical = key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0
      if (selection.length > 0) {
        const rows = vertical * (event.shiftKey ? octave : 1)
        update(
          moveNotes(trackId, selection, horizontal * grid, rows, cycle, content.mode === 'note' && snap ? scale : null),
        )
      } else {
        setRoll({
          cursor: {
            step: Math.max(0, Math.min(STEPS_PER_CYCLE - 1, cursor.step + horizontal * grid)),
            midi: Math.max(LOWEST, Math.min(HIGHEST, cursor.midi + vertical * (event.shiftKey ? 12 : 1))),
          },
        })
      }
    }
  }

  const byId = new Map(content.notes.map((n) => [n.id, n]))
  const label = (note: Note) => {
    const pitch = pitchOnCycle(note, cycle === 'all' ? 1 : cycle)
    return typeof pitch === 'number'
      ? displayNoteName(midiToNoteName(noteMidi(note, cycle, scale)))
      : displayNoteName(pitch)
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-[64px_1fr]" style={{ height: ROWS * ROW_HEIGHT }}>
        <div aria-hidden="true" className="relative">
          {Array.from({ length: ROWS }, (_, row) => {
            const midi = midiOfRow(row)
            const black = BLACK_KEYS.has(midi % 12)
            return (
              <div
                key={row}
                className={`absolute right-0 left-0 flex items-center justify-end border-b border-bg-app pr-2 font-mono text-knob-value ${black ? 'bg-bg-code text-text-2' : 'bg-raised-2 text-text-2'}`}
                style={{ top: row * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                {displayNoteName(midiToNoteName(midi))}
              </div>
            )
          })}
        </div>
        <div
          ref={areaRef}
          role="application"
          aria-label="Piano roll. Arrows move the cursor or the selected notes, Enter adds a note, Delete removes, Shift with up or down moves by an octave."
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={`group relative touch-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-text-2 ${tool === 'eraser' ? 'cursor-cell' : tool === 'select' ? 'cursor-crosshair' : 'cursor-copy'}`}
        >
          {Array.from({ length: ROWS }, (_, row) => {
            const midi = midiOfRow(row)
            const outside = scale !== null && !inScale(midi, scale)
            return (
              <div
                key={row}
                aria-hidden="true"
                className={`absolute right-0 left-0 border-b border-bg-app ${outside ? 'bg-bg-deep' : BLACK_KEYS.has(midi % 12) ? 'bg-bg-code' : 'bg-panel'}`}
                style={{ top: row * ROW_HEIGHT, height: ROW_HEIGHT }}
              />
            )
          })}
          {Array.from({ length: STEPS_PER_CYCLE }, (_, step) => (
            <div
              key={step}
              aria-hidden="true"
              className={`absolute top-0 bottom-0 w-px ${step % 4 === 0 ? 'bg-line-strong' : 'bg-line'}`}
              style={{ left: `${String((step / STEPS_PER_CYCLE) * 100)}%` }}
            />
          ))}
          {content.notes.flatMap((note) =>
            ghostMidis(note, cycle, scale).map((midi) => (
              <div
                key={`${note.id}-ghost-${String(midi)}`}
                aria-hidden="true"
                className={`pointer-events-none absolute rounded-xs border-2 border-dashed ${BORDER[color]} opacity-70`}
                style={{
                  top: rowOf(midi) * ROW_HEIGHT + 1,
                  height: ROW_HEIGHT - 2,
                  left: `${String((note.step / STEPS_PER_CYCLE) * 100)}%`,
                  width: `${String((note.length / STEPS_PER_CYCLE) * 100)}%`,
                }}
              />
            )),
          )}
          {content.notes.map((note) => {
            const selected = selection.includes(note.id)
            return (
              <div
                key={note.id}
                data-note={note.id}
                role="img"
                aria-label={`${label(note)}, step ${String(note.step + 1)}, ${String(note.length)} ${note.length === 1 ? 'step' : 'steps'}${selected ? ', selected' : ''}`}
                className={`absolute flex items-center overflow-hidden rounded-xs border px-1.5 font-mono text-knob-value text-bg-app ${FILL[color]} ${selected ? 'border-text brightness-125' : 'border-transparent'}`}
                style={{
                  top: rowOf(noteMidi(note, cycle, scale)) * ROW_HEIGHT + 1,
                  height: ROW_HEIGHT - 2,
                  left: `${String((note.step / STEPS_PER_CYCLE) * 100)}%`,
                  width: `${String((note.length / STEPS_PER_CYCLE) * 100)}%`,
                  opacity: 0.45 + 0.55 * note.velocity,
                }}
              >
                <span className="truncate">{label(note)}</span>
                <span data-edge="true" className="absolute top-0 right-0 bottom-0 w-[7px] cursor-ew-resize" />
              </div>
            )
          })}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute hidden rounded-xs border border-dashed border-text-3 group-focus-visible:block"
            style={{
              top: rowOf(cursor.midi) * ROW_HEIGHT,
              height: ROW_HEIGHT,
              left: `${String((cursor.step / STEPS_PER_CYCLE) * 100)}%`,
              width: `${String((grid / STEPS_PER_CYCLE) * 100)}%`,
            }}
          />
          {band && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute border border-text-2 bg-active/40"
              style={{
                left: Math.min(band.x0, band.x1),
                top: Math.min(band.y0, band.y1),
                width: Math.abs(band.x1 - band.x0),
                height: Math.abs(band.y1 - band.y0),
              }}
            />
          )}
          <RollPlayhead />
          {byId.size === 0 && (
            <p className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-body text-text-2">
              Draw notes with the pencil, or press Enter to add one at the cursor.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
