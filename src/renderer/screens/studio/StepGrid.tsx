import { useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { useCatalog } from '../../app/sound-catalog'
import { carries, readDrop } from '../../app/drag-data'
import { ContextMenu, type MenuItem, type MenuPosition } from '../../components/ContextMenu'
import { formatNumber } from '../../codegen/format'
import type { ID, Step, StepRow, TrackColor } from '../../model/project'
import { addRow, removeRow, setRowSound, setStep, setVariant } from '../../store/actions'
import { projectStore, useProject } from '../../store/project-store'
import { StepPlayhead } from '../../viz/StepPlayhead'
import { GRID_WIDTH, ROW_GAP, STEP_HEIGHT, STEP_WIDTH, stepX } from './step-geometry'

const ON_CLASS: Record<TrackColor, string> = {
  'track-1': 'bg-track-1',
  'track-2': 'bg-track-2',
  'track-3': 'bg-track-3',
  'track-4': 'bg-track-4',
}

const FULL: Step = { velocity: 1, probability: 1 }
const LEVELS = [1, 0.75, 0.5, 0.25]

interface Paint {
  rowId: ID
  on: boolean
}

interface StepMenu {
  position: MenuPosition
  row: StepRow
  index: number
}

/** 16-step grid of a rhythm track (SPEC 6.1): click, horizontal drag to paint, right-click for details. */
export function StepGrid({ trackId, color }: { trackId: ID; color: TrackColor }) {
  const content = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.steps)
  const catalog = useCatalog()
  const [focus, setFocus] = useState({ row: 0, step: 0 })
  const [menu, setMenu] = useState<StepMenu | null>(null)
  const [addMenu, setAddMenu] = useState<MenuPosition | null>(null)
  const [rowMenu, setRowMenu] = useState<{ position: MenuPosition; row: StepRow } | null>(null)
  const [dropRow, setDropRow] = useState<ID | null>(null)
  const paint = useRef<Paint | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  if (!content) return null
  const { update, beginGesture, endGesture } = projectStore.getState()
  const rows = content.rows

  const apply = (row: StepRow, index: number, on: boolean) => {
    const isOn = row.steps[index] !== null
    if (isOn !== on) update(setStep(trackId, row.id, index, on ? FULL : null))
  }

  const onPointerDown = (event: PointerEvent, row: StepRow, index: number) => {
    if (event.button !== 0) return
    event.preventDefault()
    const on = row.steps[index] === null
    paint.current = { rowId: row.id, on }
    beginGesture()
    apply(row, index, on)
    const end = () => {
      paint.current = null
      endGesture()
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointerup', end)
  }

  const onPointerEnter = (row: StepRow, index: number) => {
    const current = paint.current
    if (current?.rowId === row.id) {
      const fresh = projectStore
        .getState()
        .project.tracks.find((t) => t.id === trackId)
        ?.steps?.rows.find((r) => r.id === row.id)
      if (fresh) apply(fresh, index, current.on)
    }
  }

  const moveFocus = (row: number, step: number) => {
    const next = { row: Math.max(0, Math.min(rows.length - 1, row)), step: Math.max(0, Math.min(15, step)) }
    setFocus(next)
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${String(next.row)}-${String(next.step)}"]`)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, row: number, step: number) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Home: [0, -16],
      End: [0, 16],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      moveFocus(row + move[0], step + move[1])
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const target = rows[row]
      if (target) setMenu({ position: { x: rect.left, y: rect.bottom + 4 }, row: target, index: step })
    }
  }

  const onRowDrop = (event: DragEvent, row: StepRow) => {
    setDropRow(null)
    const dropped = readDrop(event)
    if (dropped?.kind !== 'sound') return
    event.preventDefault()
    event.stopPropagation()
    update(setRowSound(trackId, row.id, dropped.sound.name))
  }

  const stepMenuItems = (target: StepMenu): MenuItem[] => {
    const step = target.row.steps[target.index]
    const set = (next: Step | null) => () => update(setStep(trackId, target.row.id, target.index, next))
    const base = step ?? FULL
    return [
      ...LEVELS.map((velocity) => ({
        label: `Velocity ${String(velocity * 100)}%`,
        code: `.velocity(${formatNumber(velocity)})`,
        disabled: step?.velocity === velocity,
        onSelect: set({ ...base, velocity }),
      })),
      ...LEVELS.map((probability) => ({
        label: `Plays ${String(probability * 100)}% of the time`,
        code: probability === 1 ? target.row.sound : `${target.row.sound}?${formatNumber(1 - probability)}`,
        disabled: step?.probability === probability,
        onSelect: set({ ...base, probability }),
      })),
      ...Array.from(
        { length: Math.min(12, catalog.sounds.find((c) => c.name === target.row.sound)?.variants ?? 4) },
        (_, variant) => variant,
      ).map((variant) => ({
        label: `Variant ${String(variant)} for the row`,
        code: `${target.row.sound}:${String(variant)}`,
        disabled: (target.row.variant ?? 0) === variant,
        onSelect: () => update(setVariant(trackId, target.row.id, variant === 0 ? undefined : variant)),
      })),
      {
        label: step ? 'Clear step' : 'Add step',
        code: step ? '~' : target.row.sound,
        onSelect: set(step ? null : FULL),
      },
    ]
  }

  const drumSounds = catalog.sounds.filter((s) => s.category === 'Drums')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="flex flex-col" style={{ gap: ROW_GAP }}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              title={`Row ${row.sound}: right-click to remove, drop a sound to replace it`}
              onContextMenu={(event) => {
                event.preventDefault()
                setRowMenu({ position: { x: event.clientX, y: event.clientY }, row })
              }}
              onDragOver={(event) => {
                if (!carries(event, 'sound')) return
                event.preventDefault()
                setDropRow(row.id)
              }}
              onDragLeave={() => setDropRow(null)}
              onDrop={(event) => onRowDrop(event, row)}
              className={`w-9 rounded-xs text-left font-mono text-small ${dropRow === row.id ? 'bg-active text-text' : 'text-text-2'}`}
              style={{ height: STEP_HEIGHT }}
            >
              {row.sound}
              {row.variant !== undefined && <span className="text-text-3">:{row.variant}</span>}
            </button>
          ))}
        </div>
        <div ref={gridRef} role="grid" aria-label="Steps" className="relative" style={{ width: GRID_WIDTH }}>
          <div className="flex flex-col" style={{ gap: ROW_GAP }}>
            {rows.map((row, r) => (
              <div
                key={row.id}
                role="row"
                aria-label={row.sound}
                className="relative"
                style={{ height: STEP_HEIGHT }}
                onDragOver={(event) => {
                  if (!carries(event, 'sound')) return
                  event.preventDefault()
                  setDropRow(row.id)
                }}
                onDragLeave={() => setDropRow(null)}
                onDrop={(event) => onRowDrop(event, row)}
              >
                {row.steps.map((step, i) => {
                  const downbeat = i % 4 === 0
                  const off = downbeat ? 'bg-step-downbeat' : 'bg-step-off'
                  return (
                    <button
                      key={i}
                      type="button"
                      role="gridcell"
                      data-cell={`${String(r)}-${String(i)}`}
                      tabIndex={focus.row === r && focus.step === i ? 0 : -1}
                      aria-label={`${row.sound} step ${String(i + 1)}`}
                      aria-pressed={step !== null}
                      onPointerDown={(event) => onPointerDown(event, row, i)}
                      onPointerEnter={() => onPointerEnter(row, i)}
                      onClick={(event) => {
                        // Pointer clicks are handled on pointerdown; this is Enter or Space.
                        if (event.detail === 0) update(setStep(trackId, row.id, i, step ? null : FULL))
                      }}
                      onFocus={() => setFocus({ row: r, step: i })}
                      onKeyDown={(event) => onKeyDown(event, r, i)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setMenu({ position: { x: event.clientX, y: event.clientY }, row, index: i })
                      }}
                      className={`absolute top-0 rounded-control transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-text ${step ? ON_CLASS[color] : `${off} hover:bg-active`}`}
                      style={{
                        left: stepX(i),
                        width: STEP_WIDTH,
                        height: STEP_HEIGHT,
                        opacity: step ? 0.35 + 0.65 * step.velocity : 1,
                      }}
                    >
                      {step && step.probability < 1 && (
                        <span aria-hidden="true" className="font-mono text-knob-value text-bg-app">
                          ?
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <StepPlayhead rows={rows.length} />
        </div>
      </div>
      <button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setAddMenu({ x: rect.left, y: rect.bottom + 4 })
        }}
        className="self-start rounded-control px-2 py-0.5 text-small text-text-2 hover:bg-raised hover:text-text"
      >
        + Row
      </button>
      {menu && (
        <ContextMenu label="Step" position={menu.position} items={stepMenuItems(menu)} onClose={() => setMenu(null)} />
      )}
      {addMenu && (
        <ContextMenu
          label="Add a row"
          position={addMenu}
          onClose={() => setAddMenu(null)}
          items={drumSounds.map((sound) => ({
            label: sound.name,
            code: `s("${sound.name}")`,
            onSelect: () => update(addRow(trackId, sound.name)),
          }))}
        />
      )}
      {rowMenu && (
        <ContextMenu
          label={`Row ${rowMenu.row.sound}`}
          position={rowMenu.position}
          onClose={() => setRowMenu(null)}
          items={[
            ...drumSounds
              .filter((sound) => sound.name !== rowMenu.row.sound)
              .map((sound) => ({
                label: `Play ${sound.name} instead`,
                code: sound.name,
                onSelect: () => update(setRowSound(trackId, rowMenu.row.id, sound.name)),
              })),
            { label: 'Remove row', onSelect: () => update(removeRow(trackId, rowMenu.row.id)) },
          ]}
        />
      )}
    </div>
  )
}
