import { useRef, useState, type PointerEvent } from 'react'
import { formatNumber } from '../codegen/format'
import { setBpm } from '../store/actions'
import { projectStore, useProject } from '../store/project-store'

/** Tempo pill: click to type, drag vertically to adjust (SPEC 6.0). Writes setcpm(bpm/4). */
export function TempoControl() {
  const bpm = useProject((s) => s.project.transport.bpm)
  const beats = useProject((s) => s.project.transport.beatsPerCycle)
  const [editing, setEditing] = useState(false)
  const drag = useRef<{ y: number; bpm: number; moved: boolean } | null>(null)
  const { update, beginGesture, endGesture } = projectStore.getState()

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { y: event.clientY, bpm, moved: false }
    beginGesture()
  }
  const onPointerMove = (event: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const delta = (d.y - event.clientY) / (event.shiftKey ? 20 : 2)
    if (Math.abs(delta) >= 1) d.moved = true
    if (d.moved) update(setBpm(Math.round(d.bpm + delta)))
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    endGesture()
    if (d && !d.moved) setEditing(true)
  }

  return (
    <div
      className="flex h-11 items-center gap-2 rounded-pill bg-raised px-5"
      title={`setcpm(${formatNumber(bpm)}/${String(beats)})`}
    >
      <span className="text-body text-text-2">Tempo</span>
      {editing ? (
        <input
          autoFocus
          aria-label="Tempo in BPM"
          defaultValue={formatNumber(bpm)}
          onBlur={(event) => {
            const value = Number(event.target.value.replace(',', '.'))
            if (Number.isFinite(value) && value > 0) update(setBpm(value))
            setEditing(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setEditing(false)
          }}
          className="w-14 rounded-xs bg-bg-code px-1 font-mono text-body-lg text-text outline-none"
        />
      ) : (
        <button
          type="button"
          aria-label={`Tempo ${formatNumber(bpm)} BPM. Drag up or down, or press Enter to type`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              update(setBpm(bpm + (event.key === 'ArrowUp' ? 1 : -1)))
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              setEditing(true)
            }
          }}
          className="cursor-ns-resize touch-none font-mono text-body-lg text-text"
        >
          {formatNumber(bpm)} BPM
        </button>
      )}
    </div>
  )
}
