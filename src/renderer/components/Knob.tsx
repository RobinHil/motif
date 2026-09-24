import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatNumber } from '../codegen/format'
import type { Modulation } from '../model/project'
import { ContextMenu, type MenuPosition } from './ContextMenu'
import { arcPath, clamp, fromNormalized, parseTyped, toNormalized, type KnobRange } from './knob-math'

/** Pixels of vertical drag for the whole range; Shift divides the speed by 10. */
const DRAG_RANGE_PX = 200
const WHEEL_GESTURE_MS = 400

export interface KnobProps {
  label: string
  /** Strudel function name, shown with the value (golden rule: the app teaches Strudel). */
  code: string
  /** `undefined` when the parameter is absent from the code. */
  value: number | Modulation | undefined
  range: KnobRange
  /** What Strudel plays when the parameter is absent. */
  defaultValue: number
  /** Shown instead of the number when the parameter is absent, e.g. "open" for the filter. */
  absentLabel?: string
  /** Design token of the value arc, e.g. "track-1". */
  color: string
  size?: 40 | 48
  /** A value equal to the default removes the parameter (nothing is written). */
  onChange: (value: number | undefined) => void
  onReset: () => void
  onGestureStart: () => void
  onGestureEnd: () => void
}

function valueText(props: KnobProps): string {
  const { value, code } = props
  if (value === undefined) return `${code} ${props.absentLabel ?? formatNumber(props.defaultValue)}`
  if (typeof value === 'number') return `${code} ${formatNumber(value)}`
  return value.kind === 'signal' ? `${code} ${value.shape}` : `${code} <...>`
}

/** Knob (DESIGN.md "Knob", SPEC 6.1 "Knob behavior"). */
export function Knob(props: KnobProps) {
  const { label, value, range, defaultValue, color, size = 48 } = props
  const [editing, setEditing] = useState(false)
  const [menu, setMenu] = useState<MenuPosition | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ startY: number; start: number } | null>(null)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  const modulated = typeof value === 'object'
  const current = typeof value === 'number' ? value : defaultValue
  const position = toNormalized(current, range)

  const commit = (next: number) => {
    const rounded = fromNormalized(toNormalized(next, range), range)
    props.onChange(rounded === defaultValue ? undefined : rounded)
  }

  // Wheel needs a non-passive listener to stop the panel from scrolling.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      const { value: v, range: r, defaultValue: d } = latest.current
      if (typeof v === 'object') return
      event.preventDefault()
      if (wheelTimer.current === null) latest.current.onGestureStart()
      else clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => {
        wheelTimer.current = null
        latest.current.onGestureEnd()
      }, WHEEL_GESTURE_MS)
      const step = (event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 0.002 : 0.02)
      const next = fromNormalized(toNormalized(v ?? d, r) + step, r)
      latest.current.onChange(next === d ? undefined : next)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      svg.removeEventListener('wheel', onWheel)
    }
  }, [])

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || modulated) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, start: position }
    props.onGestureStart()
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const speed = event.shiftKey ? 0.1 : 1
    const next = drag.current.start + ((drag.current.startY - event.clientY) / DRAG_RANGE_PX) * speed
    commit(fromNormalized(clamp(next, 0, 1), range))
  }

  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    props.onGestureEnd()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (modulated) return
    const fine = event.shiftKey ? 0.1 : 1
    const moves: Record<string, number> = {
      ArrowUp: 0.01 * fine,
      ArrowRight: 0.01 * fine,
      ArrowDown: -0.01 * fine,
      ArrowLeft: -0.01 * fine,
      PageUp: 0.1,
      PageDown: -0.1,
    }
    const move = moves[event.key]
    if (move !== undefined) {
      event.preventDefault()
      commit(fromNormalized(position + move, range))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      commit(event.key === 'Home' ? range.min : range.max)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      props.onReset()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      setEditing(true)
    }
  }

  const onMenuKey = (event: KeyboardEvent) => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return false
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu({ x: rect.left, y: rect.bottom + 4 })
    return true
  }

  const r = size / 2 - 3
  const center = size / 2
  const arc = modulated
    ? arcPath(
        center,
        center,
        r,
        toNormalized(value.kind === 'signal' ? value.min : Math.min(...value.values), range),
        toNormalized(value.kind === 'signal' ? value.max : Math.max(...value.values), range),
      )
    : arcPath(center, center, r, 0, position)

  return (
    <div className="flex w-[76px] flex-col items-center gap-1">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={range.min}
        aria-valuemax={range.max}
        aria-valuenow={current}
        aria-valuetext={valueText(props)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={props.onReset}
        onKeyDown={(event) => {
          if (!onMenuKey(event)) onKeyDown(event)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY })
        }}
        className="cursor-ns-resize rounded-pill touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-2"
      >
        <path
          d={arcPath(center, center, r, 0, 1)}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {arc && (
          <path
            d={arc}
            fill="none"
            stroke={`var(--color-${modulated ? 'mod' : color})`}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
        <circle cx={center} cy={center} r={r - 6} fill="var(--color-knob-core)" />
      </svg>
      <span className="text-body text-text">{label}</span>
      {editing ? (
        <input
          autoFocus
          aria-label={`${label} value`}
          defaultValue={typeof value === 'number' ? formatNumber(value) : ''}
          onBlur={(event) => {
            const typed = parseTyped(event.target.value, range)
            if (typed !== null) {
              props.onGestureStart()
              commit(typed)
              props.onGestureEnd()
            }
            setEditing(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setEditing(false)
          }}
          className="w-16 rounded-xs bg-bg-code px-1 text-center font-mono text-knob-value text-text outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={modulated}
          title={modulated ? 'This parameter is animated' : 'Click to type a value'}
          onClick={() => setEditing(true)}
          className={`font-mono text-knob-value whitespace-nowrap ${modulated ? 'text-mod' : 'text-text-2 hover:text-text'}`}
        >
          {valueText(props)}
        </button>
      )}
      {menu && (
        <ContextMenu
          label={`${label} menu`}
          position={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Animate', disabled: true, hint: 'Animation arrives with the Modulation screen' },
            { label: 'Freeze', disabled: true, hint: 'Freezing arrives with the Modulation screen' },
            { label: 'MIDI learn', disabled: true, hint: 'MIDI arrives in a later version' },
            {
              label: 'Reset',
              code: `${props.code} ${props.absentLabel ?? formatNumber(defaultValue)}`,
              onSelect: props.onReset,
            },
          ]}
        />
      )}
    </div>
  )
}
