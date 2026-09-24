import { useEffect, useRef } from 'react'
import { fitCanvas, onFrame } from './frame-loop'

const DECAY = 0.92

/** Two vertical bars (left, right), white at 55% as in DESIGN.md "Fader", drawn every frame. */
export function StereoMeter({ levels, label }: { levels: () => [number, number]; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const read = useRef(levels)
  useEffect(() => {
    read.current = levels
  }, [levels])

  useEffect(() => {
    const shown: [number, number] = [0, 0]
    let drawn = ''
    return onFrame(() => {
      const canvas = ref.current
      if (!canvas) return
      const [l, r] = read.current()
      shown[0] = Math.max(l, shown[0] * DECAY)
      shown[1] = Math.max(r, shown[1] * DECAY)
      const key = `${shown[0].toFixed(3)}|${shown[1].toFixed(3)}`
      if (key === drawn) return
      drawn = key
      const context = fitCanvas(canvas)
      if (!context) return
      const { clientWidth: width, clientHeight: height } = canvas
      context.clearRect(0, 0, width, height)
      const bar = (width - 3) / 2
      shown.forEach((level, i) => {
        const h = Math.min(1, level) * height
        context.fillStyle = 'rgba(237, 237, 239, 0.55)'
        context.fillRect(i * (bar + 3), height - h, bar, h)
      })
    })
  }, [])

  return <canvas ref={ref} role="img" aria-label={`${label} level`} className="h-full w-[18px]" />
}
