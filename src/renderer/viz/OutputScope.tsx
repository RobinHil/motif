import { useEffect, useRef } from 'react'
import { masterSpectrum, masterWaveform } from '../engine/engine'
import { drawSpectrum, drawWaveform } from './draw'
import { fitCanvas, onFrame, token } from './frame-loop'

/** Master spectrum or oscilloscope, drawn every frame from the master bus analyser. */
export function OutputScope({
  kind,
  label,
  className,
}: {
  kind: 'spectrum' | 'scope'
  label: string
  className: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const spectrum = new Float32Array(1024)
    const wave = new Float32Array(2048)
    const accent = token('accent')
    return onFrame(() => {
      const canvas = ref.current
      if (!canvas) return
      const context = fitCanvas(canvas)
      if (!context) return
      const { clientWidth: width, clientHeight: height } = canvas
      context.clearRect(0, 0, width, height)
      if (kind === 'spectrum') {
        if (masterSpectrum(spectrum)) drawSpectrum(context, width, height, spectrum, accent, 48)
      } else if (masterWaveform(wave)) {
        drawWaveform(context, width, height, wave)
      } else {
        wave.fill(0)
        drawWaveform(context, width, height, wave)
      }
    })
  }, [kind])

  return <canvas ref={ref} role="img" aria-label={label} className={`w-full rounded-input bg-bg-code ${className}`} />
}
