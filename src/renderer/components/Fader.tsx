import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { formatNumber } from '../codegen/format'
import type { MidiTarget } from '../midi/targets'
import { clamp, fromNormalized, toNormalized, type KnobRange } from './knob-math'
import { learnOutline, useMidiBinding } from './useMidiBinding'

const THUMB_HEIGHT = 22
const WHEEL_GESTURE_MS = 400

export interface FaderProps {
  label: string
  value: number
  range: KnobRange
  defaultValue: number
  onChange: (value: number) => void
  onGestureStart: () => void
  onGestureEnd: () => void
  /** Drawn on the left of the rail, usually a stereo meter. */
  meter?: ReactNode
  /** What a MIDI controller drives through this fader. */
  midi?: MidiTarget
}

/** Vertical fader (DESIGN.md "Fader"): 6 px rail, 36 x 22 px thumb, meter on the left. */
export function Fader(props: FaderProps) {
  const { label, value, range, defaultValue } = props
  const railRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; start: number } | null>(null)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })
  const position = toNormalized(value, range)
  const binding = useMidiBinding(props.midi)

  const travel = () => Math.max(1, (railRef.current?.clientHeight ?? 200) - THUMB_HEIGHT)
  const commit = (next: number) => props.onChange(fromNormalized(clamp(next, 0, 1), range))

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const current = latest.current
      if (wheelTimer.current === null) current.onGestureStart()
      else clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => {
        wheelTimer.current = null
        latest.current.onGestureEnd()
      }, WHEEL_GESTURE_MS)
      const step = (event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 0.002 : 0.02)
      current.onChange(fromNormalized(clamp(toNormalized(current.value, current.range) + step, 0, 1), current.range))
    }
    rail.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      rail.removeEventListener('wheel', onWheel)
    }
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    props.onGestureStart()
    const rect = event.currentTarget.getBoundingClientRect()
    const onThumb = (event.target as HTMLElement).dataset['thumb'] === 'true'
    // Clicking the rail jumps there; grabbing the thumb keeps it under the pointer.
    const start = onThumb ? position : 1 - (event.clientY - rect.top - THUMB_HEIGHT / 2) / travel()
    if (!onThumb) commit(start)
    drag.current = { startY: event.clientY, start: clamp(start, 0, 1) }
  }

  const onPointerMove = (event: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const speed = event.shiftKey ? 0.1 : 1
    commit(d.start + ((d.startY - event.clientY) / travel()) * speed)
  }

  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    props.onGestureEnd()
  }

  const onKeyDown = (event: KeyboardEvent) => {
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
      commit(position + move)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      commit(event.key === 'Home' ? 0 : 1)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      props.onChange(defaultValue)
    }
  }

  return (
    <div className="flex h-full min-h-40 gap-3">
      {props.meter}
      <div
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={range.min}
        aria-valuemax={range.max}
        aria-valuenow={value}
        aria-valuetext={formatNumber(value)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => props.onChange(defaultValue)}
        onKeyDown={onKeyDown}
        // In MIDI learn mode a click or Enter picks the fader as the next control to map.
        onPointerDownCapture={(event) => {
          if (!binding.learning || event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          binding.pick()
        }}
        onKeyDownCapture={(event) => {
          if (!binding.learning || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          event.stopPropagation()
          binding.pick()
        }}
        data-midi-learn={binding.learning ? (binding.selected ? 'selected' : 'mappable') : undefined}
        className={`relative h-full w-9 cursor-ns-resize touch-none rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-2 ${learnOutline(binding)}`}
      >
        <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-pill bg-bg-code" />
        <div
          data-thumb="true"
          className="absolute left-0 h-[22px] w-9 rounded-xs border border-line-strong bg-active"
          style={{ bottom: `calc(${String(position)} * (100% - ${String(THUMB_HEIGHT)}px))` }}
        />
      </div>
    </div>
  )
}
