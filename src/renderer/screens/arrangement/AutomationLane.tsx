import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { Automation, Track } from '../../model/project'
import {
  movePoint,
  removeAutomation,
  removePoint,
  setAutomationTarget,
  setPoint,
} from '../../store/arrangement-actions'
import { projectStore } from '../../store/project-store'
import { describeValue, heightOf, paramOf, targetOptions, targetValue, valueAt } from './automation-targets'
import { cycleAt, percent } from './timeline-geometry'

const LANE_HEIGHT = 96
const PAD = 10

/** A point-based automation curve over the song (SPEC 6.5). Click adds a point, double-click removes it. */
export function AutomationLane(props: { automation: Automation; tracks: readonly Track[]; visible: number }) {
  const { automation, tracks, visible } = props
  const areaRef = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  const param = paramOf(automation)
  const { update, beginGesture, endGesture } = projectStore.getState()
  if (!param) return null

  const options = targetOptions(tracks)
  const inner = LANE_HEIGHT - PAD * 2
  const yOf = (value: number) => PAD + (1 - heightOf(value, param)) * inner
  const locate = (clientX: number, clientY: number) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return null
    const height = 1 - (clientY - rect.top - PAD) / inner
    return { cycle: cycleAt(clientX, rect, visible), value: valueAt(Math.min(1, Math.max(0, height)), param) }
  }

  const points = automation.points
  const first = points[0]
  const last = points.at(-1)
  // Held before the first point and after the last one, as the song plays it.
  const line = [
    ...(first ? [{ cycle: 0, value: first.value }] : []),
    ...points,
    ...(last ? [{ cycle: visible, value: last.value }] : []),
  ]
  const path = line
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${String((p.cycle / visible) * 1000)} ${String(yOf(p.value))}`)
    .join(' ')

  const onPointKey = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    const point = points[index]
    if (!point) return
    const nudge = event.shiftKey ? 0.1 : 0.02
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, nudge],
      ArrowDown: [0, -nudge],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      const height = Math.min(1, Math.max(0, heightOf(point.value, param) + move[1]))
      update(movePoint(automation.id, index, point.cycle + move[0], valueAt(height, param)))
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      update(removePoint(automation.id, index))
    }
  }

  return (
    <div className="grid grid-cols-[200px_1fr] border-t border-line">
      <div className="flex flex-col gap-1.5 px-4 py-3">
        <span className="text-body-lg">Automation</span>
        <select
          aria-label="Automated parameter"
          value={targetValue(automation.target)}
          onChange={(event) => {
            const option = options.find((o) => o.value === event.target.value)
            if (option) update(setAutomationTarget(automation.id, option.target))
          }}
          className="w-full truncate bg-transparent font-mono text-small text-mod outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => update(removeAutomation(automation.id))}
          className="self-start text-small text-text-3 hover:text-text"
        >
          Remove
        </button>
      </div>
      <div
        ref={areaRef}
        role="group"
        aria-label={`Automation of ${automation.target.param}. Click to add a point.`}
        onClick={(event) => {
          if (event.target !== event.currentTarget && !(event.target instanceof SVGElement)) return
          const at = locate(event.clientX, event.clientY)
          if (at) update(setPoint(automation.id, at.cycle, at.value))
        }}
        className="relative cursor-crosshair"
        style={{ height: LANE_HEIGHT }}
      >
        <svg
          aria-hidden="true"
          viewBox={`0 0 1000 ${String(LANE_HEIGHT)}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path d={path} fill="none" stroke="var(--color-mod)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((point, index) => (
          <button
            key={index}
            type="button"
            role="slider"
            aria-label={`Point ${String(index + 1)}, cycle ${String(point.cycle)}`}
            aria-valuenow={point.value}
            aria-valuetext={`${describeValue(point.value, param)} at cycle ${String(point.cycle)}`}
            title={`${describeValue(point.value, param)} at cycle ${String(point.cycle)}. Double-click to remove.`}
            onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = index
              beginGesture()
            }}
            onPointerMove={(event) => {
              if (drag.current !== index) return
              const at = locate(event.clientX, event.clientY)
              if (at) update(movePoint(automation.id, index, at.cycle, at.value))
            }}
            onPointerUp={() => {
              if (drag.current === null) return
              drag.current = null
              endGesture()
            }}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              event.stopPropagation()
              update(removePoint(automation.id, index))
            }}
            onKeyDown={(event) => onPointKey(index, event)}
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 touch-none rounded-pill bg-mod outline-none focus-visible:ring-2 focus-visible:ring-text"
            style={{ left: percent(point.cycle, visible), top: yOf(point.value) }}
          />
        ))}
      </div>
    </div>
  )
}
