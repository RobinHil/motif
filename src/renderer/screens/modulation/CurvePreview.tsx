import { useEffect, useMemo, useRef } from 'react'
import { getCycle, isPlaying } from '../../engine/engine'
import { modulationCurve } from '../../engine/modulation-curve'
import type { Modulation } from '../../model/project'
import { fitCanvas, onFrame, token } from '../../viz/frame-loop'
import { bounds, withUnit } from './modulation-targets'

const CYCLES_SHOWN = 4
const POINTS = 480
const PAD_Y = 30

/** The modulation over 4 cycles, computed locally from Strudel's signals, with the playhead (SPEC 6.4). */
export function CurvePreview({ mod, unit }: { mod: Modulation; unit: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const curve = useMemo(() => modulationCurve(mod, CYCLES_SHOWN, POINTS), [mod])
  const [low, high] = bounds(mod)
  const stepped = mod.kind === 'sequence' || shapeIsStepped(mod)
  const data = useRef({ curve, low, high, stepped })
  useEffect(() => {
    data.current = { curve, low, high, stepped }
  })

  useEffect(() => {
    const colors = { mod: token('mod'), line: token('line-strong'), text: token('text') }
    let drawn = ''
    let drawnCurve: number[] | null = null
    return onFrame(() => {
      const canvas = ref.current
      if (!canvas) return
      const { curve: values, low: lo, high: hi, stepped: steps } = data.current
      const phase = isPlaying() ? (getCycle() % CYCLES_SHOWN) / CYCLES_SHOWN : -1
      const key = `${String(canvas.clientWidth)}x${String(canvas.clientHeight)} ${phase.toFixed(4)}`
      if (key === drawn && values === drawnCurve) return
      drawn = key
      drawnCurve = values
      const context = fitCanvas(canvas)
      if (!context) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      context.clearRect(0, 0, width, height)
      const span = hi - lo || 1
      const y = (v: number) => height - PAD_Y - ((v - lo) / span) * (height - PAD_Y * 2)

      context.strokeStyle = colors.line
      context.lineWidth = 1
      context.setLineDash([3, 4])
      for (let c = 1; c < CYCLES_SHOWN; c++) {
        const x = Math.round((c / CYCLES_SHOWN) * width) + 0.5
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      context.setLineDash([])

      context.strokeStyle = colors.mod
      context.lineWidth = 2
      context.lineJoin = 'round'
      context.beginPath()
      values.forEach((v, i) => {
        const x = (i / (values.length - 1)) * width
        const previous = values[i - 1]
        if (i === 0) context.moveTo(x, y(v))
        else if (steps && previous !== undefined && previous !== v) {
          context.lineTo(x, y(previous))
          context.lineTo(x, y(v))
        } else context.lineTo(x, y(v))
      })
      context.stroke()

      if (phase >= 0) {
        const x = phase * width
        const value = values[Math.min(values.length - 1, Math.round(phase * (values.length - 1)))] ?? lo
        context.fillStyle = colors.text
        context.fillRect(Math.round(x), 0, 1.5, height)
        context.beginPath()
        context.arc(x, y(value), 4.5, 0, Math.PI * 2)
        context.fillStyle = colors.mod
        context.fill()
      }
    })
  }, [])

  return (
    <div className="relative h-[300px] overflow-hidden rounded-panel bg-bg-code">
      <canvas
        ref={ref}
        role="img"
        aria-label={`Curve over ${String(CYCLES_SHOWN)} cycles, from ${withUnit(low, unit)} to ${withUnit(high, unit)}`}
        className="absolute inset-0 h-full w-full"
      />
      <span className="absolute top-3 left-3 font-mono text-small text-text-2">{withUnit(high, unit)}</span>
      <span className="absolute bottom-3 left-3 font-mono text-small text-text-2">{withUnit(low, unit)}</span>
      <span className="absolute top-3 right-3 text-small text-text-2">{CYCLES_SHOWN} cycles shown</span>
    </div>
  )
}

function shapeIsStepped(mod: Modulation) {
  return mod.kind === 'signal' && mod.shape === 'square'
}
