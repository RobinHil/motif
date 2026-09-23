import { useEffect, useRef } from 'react'
import { getCycle, isPlaying } from '../engine/engine'
import { GRID_WIDTH, rowY, STEP_HEIGHT, STEP_WIDTH, stepAt, stepX } from '../screens/studio/step-geometry'
import { fitCanvas, onFrame, token } from './frame-loop'

/** Outline on the step being played, drawn on a canvas over the grid (golden rule 3). */
export function StepPlayhead({ rows }: { rows: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let drawn = -2
    const color = token('step-playing')
    return onFrame(() => {
      const canvas = ref.current
      if (!canvas) return
      const step = isPlaying() ? stepAt(getCycle()) : -1
      if (step === drawn) return
      drawn = step
      const context = fitCanvas(canvas)
      if (!context) return
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      if (step < 0) return
      context.strokeStyle = color
      context.lineWidth = 2
      for (let row = 0; row < rows; row++) {
        context.beginPath()
        context.roundRect(stepX(step) + 1, rowY(row) + 1, STEP_WIDTH - 2, STEP_HEIGHT - 2, 6)
        context.stroke()
      }
    })
  }, [rows])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0"
      style={{ width: GRID_WIDTH, height: Math.max(0, rowY(rows) - 6) }}
    />
  )
}
