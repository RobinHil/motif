import { useEffect, useRef } from 'react'
import { eventsBetween, getCycle, isPlaying, masterSpectrum } from '../engine/engine'
import { drawSpectrum } from './draw'
import { fitCanvas, onFrame, token } from './frame-loop'

type Kind = 'punchcard' | 'pianoroll' | 'spectrum'

const WINDOW = 2 // cycles shown: one behind, one ahead

/**
 * Canvas visualizations of the code screen (SPEC 6.6): punchcard (events per orbit), piano roll
 * (events per pitch) and the master spectrum. Drawn every frame outside React.
 */
export function CodeVisual({ kind, colors }: { kind: Kind; colors: Map<number, string> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const colorsRef = useRef(colors)
  useEffect(() => {
    colorsRef.current = colors
  }, [colors])

  useEffect(() => {
    const spectrum = new Float32Array(1024)
    const idle = token('line-strong')
    const playhead = token('text')
    const accent = token('accent')
    return onFrame(() => {
      const canvas = ref.current
      if (!canvas) return
      const context = fitCanvas(canvas)
      if (!context) return
      const { clientWidth: width, clientHeight: height } = canvas
      context.clearRect(0, 0, width, height)

      if (kind === 'spectrum') {
        if (masterSpectrum(spectrum)) drawSpectrum(context, width, height, spectrum, accent)
        return
      }

      const now = isPlaying() ? getCycle() : 0
      const from = now - WINDOW / 2
      const events = eventsBetween(from, from + WINDOW)
      const x = (cycle: number) => ((cycle - from) / WINDOW) * width
      if (kind === 'punchcard') {
        const orbits = [...new Set(events.map((e) => e.orbit))].sort((a, b) => a - b)
        const lane = height / Math.max(1, orbits.length)
        for (const event of events) {
          context.fillStyle = colorsRef.current.get(event.orbit) ?? idle
          context.globalAlpha = event.begin <= now && event.end > now ? 1 : 0.55
          context.fillRect(
            x(event.begin),
            orbits.indexOf(event.orbit) * lane + 2,
            Math.max(2, x(event.end) - x(event.begin) - 2),
            lane - 4,
          )
        }
      } else {
        const pitched = events.filter((e) => e.midi !== null)
        const pitches = pitched.map((e) => e.midi ?? 0)
        const low = Math.min(...pitches, 127)
        const span = Math.max(12, Math.max(...pitches, 0) - low + 1)
        const row = height / span
        for (const event of pitched) {
          context.fillStyle = colorsRef.current.get(event.orbit) ?? idle
          context.globalAlpha = event.begin <= now && event.end > now ? 1 : 0.55
          context.fillRect(
            x(event.begin),
            height - ((event.midi ?? low) - low + 1) * row,
            Math.max(2, x(event.end) - x(event.begin) - 1),
            Math.max(2, row - 1),
          )
        }
      }
      context.globalAlpha = 1
      context.fillStyle = playhead
      context.fillRect(width / 2, 0, 1, height)
    })
  }, [kind])

  const labels: Record<Kind, string> = {
    punchcard: 'Punchcard of the playing events',
    pianoroll: 'Piano roll of the playing notes',
    spectrum: 'Spectrum of the output',
  }
  return <canvas ref={ref} role="img" aria-label={labels[kind]} className="h-24 w-full rounded-input bg-bg-code" />
}
