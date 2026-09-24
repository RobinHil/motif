import { useEffect, useRef } from 'react'
import { trackLevel } from '../engine/engine'
import { fitCanvas, onFrame, token } from './frame-loop'

const BARS = 7
const DECAY = 0.9

/** Level meter of a track's orbit (SPIKE 2: one analyser per orbit), drawn on canvas every frame. */
export function TrackMeter({ orbit, label }: { orbit: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let shown = 0
    let lit = -1
    const idle = token('line-strong')
    const level = 'rgba(237, 237, 239, 0.55)'
    const peak = token('accent')
    return onFrame(() => {
      const canvas = ref.current
      if (!canvas) return
      shown = Math.max(trackLevel(orbit), shown * DECAY)
      const count = Math.round(Math.min(1, shown * 1.4) * BARS)
      if (count === lit) return
      lit = count
      const context = fitCanvas(canvas)
      if (!context) return
      const { clientWidth: width, clientHeight: height } = canvas
      context.clearRect(0, 0, width, height)
      const barWidth = (width - (BARS - 1) * 2) / BARS
      for (let i = 0; i < BARS; i++) {
        const barHeight = height * (0.35 + (0.65 * i) / (BARS - 1))
        context.fillStyle = i >= count ? idle : i >= BARS - 2 ? peak : level
        context.fillRect(i * (barWidth + 2), height - barHeight, barWidth, barHeight)
      }
    })
  }, [orbit])

  return <canvas ref={ref} role="img" aria-label={`${label} level`} className="h-4 w-[76px]" />
}
