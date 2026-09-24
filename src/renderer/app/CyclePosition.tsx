import { useEffect, useRef } from 'react'
import { getCycle, isPlaying } from '../engine/engine'
import { fitCanvas, onFrame, token } from '../viz/frame-loop'

/**
 * Position in cycles with 4 progress segments (SPEC 6.0). Updated from the shared frame loop
 * straight into the DOM and a canvas: no React state (golden rule 3).
 */
export function CyclePosition() {
  const text = useRef<HTMLSpanElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let shown = ''
    let lit = -1
    const on = token('accent')
    const off = token('line-strong')
    return onFrame(() => {
      const cycle = isPlaying() ? getCycle() : 0
      const label = cycle.toFixed(1)
      if (text.current && label !== shown) {
        shown = label
        text.current.textContent = label
      }
      const segments = isPlaying() ? (Math.floor(cycle) % 4) + 1 : 0
      if (!canvas.current || segments === lit) return
      lit = segments
      const context = fitCanvas(canvas.current)
      if (!context) return
      const { clientWidth: width, clientHeight: height } = canvas.current
      context.clearRect(0, 0, width, height)
      const w = (width - 3 * 6) / 4
      for (let i = 0; i < 4; i++) {
        context.fillStyle = i < segments ? on : off
        context.beginPath()
        context.roundRect(i * (w + 6), 0, w, height, height / 2)
        context.fill()
      }
    })
  }, [])

  return (
    <div className="flex shrink-0 flex-col gap-1.5" aria-label="Position in cycles">
      <span className="font-mono text-body text-text">
        cycle <span ref={text}>0.0</span>
      </span>
      <canvas ref={canvas} aria-hidden="true" className="h-1 w-[76px]" />
    </div>
  )
}
