import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { formatNumber } from '../../codegen/format'
import type { TrackColor } from '../../model/project'
import { fitCanvas, token } from '../../viz/frame-loop'

export interface WaveformProps {
  peaks: [number, number][] | null
  color: TrackColor
  begin: number
  end: number
  /** Slice lines: over the whole sample (slice, splice) or over the region (chop). */
  slices: { parts: number; withinRegion: boolean } | null
  onRegion: (begin: number, end: number) => void
  onGestureStart: () => void
  onGestureEnd: () => void
  /** Clicked at position 0..1 of the sample. */
  onPick: (position: number) => void
}

const HANDLE_KEYS: Record<string, number> = { ArrowLeft: -0.01, ArrowDown: -0.01, ArrowRight: 0.01, ArrowUp: 0.01 }

/** Waveform of a sample with draggable start and end handles (`begin`, `end`) and slice lines. */
export function SampleWaveform(props: WaveformProps) {
  const { peaks, color, begin, end, slices } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'begin' | 'end' | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = fitCanvas(canvas)
    if (!context) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    context.clearRect(0, 0, width, height)
    if (!peaks) return
    const middle = height / 2
    const fill = token(color)
    const dim = token('text-3')
    peaks.forEach(([min, max], i) => {
      const x = (i / peaks.length) * width
      const position = i / peaks.length
      context.fillStyle = position >= begin && position < end ? fill : dim
      const top = middle - max * middle * 0.95
      context.fillRect(x, top, Math.max(1, width / peaks.length - 0.5), Math.max(1, (max - min) * middle * 0.95))
    })
    if (slices && slices.parts > 1) {
      const from = slices.withinRegion ? begin : 0
      const to = slices.withinRegion ? end : 1
      context.strokeStyle = token('text-2')
      context.setLineDash([3, 3])
      for (let i = 1; i < slices.parts; i++) {
        const x = Math.round((from + ((to - from) * i) / slices.parts) * width) + 0.5
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      context.setLineDash([])
    }
  }, [peaks, color, begin, end, slices])

  const position = (clientX: number) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  const move = (which: 'begin' | 'end', value: number) => {
    if (which === 'begin') props.onRegion(Math.min(value, end - 0.001), end)
    else props.onRegion(begin, Math.max(value, begin + 0.001))
  }

  const handle = (which: 'begin' | 'end') => {
    const value = which === 'begin' ? begin : end
    return (
      <div
        role="slider"
        tabIndex={0}
        aria-label={which === 'begin' ? 'Start (begin)' : 'End (end)'}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={`${which} ${formatNumber(value)}`}
        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
          event.stopPropagation()
          event.currentTarget.setPointerCapture(event.pointerId)
          dragging.current = which
          props.onGestureStart()
        }}
        onPointerMove={(event) => {
          if (dragging.current === which) move(which, position(event.clientX))
        }}
        onPointerUp={() => {
          if (dragging.current === null) return
          dragging.current = null
          props.onGestureEnd()
        }}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          const step = HANDLE_KEYS[event.key]
          if (step === undefined) return
          event.preventDefault()
          move(which, value + step * (event.shiftKey ? 0.1 : 1))
        }}
        className="group absolute top-0 bottom-0 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize touch-none justify-center outline-none"
        style={{ left: `${String(value * 100)}%` }}
      >
        <span className="h-full w-0.5 bg-text group-focus-visible:w-1" />
        <span className="absolute -top-6 rounded-xs bg-raised px-1.5 font-mono text-knob-value whitespace-nowrap text-text-2">
          {which} {formatNumber(value)}
        </span>
      </div>
    )
  }

  return (
    <div className="pt-6">
      <div
        ref={areaRef}
        onClick={(event) => props.onPick(position(event.clientX))}
        className="relative h-44 cursor-pointer rounded-panel bg-bg-code"
      >
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
        {!peaks && (
          <span className="absolute inset-0 grid place-items-center text-body text-text-3">Reading the sample...</span>
        )}
        {handle('begin')}
        {handle('end')}
      </div>
    </div>
  )
}
