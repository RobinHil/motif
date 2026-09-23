import { useEffect, useRef } from 'react'
import { getCycle } from '../engine/engine'

/** Playback position, written straight into the DOM every frame: no React state (golden rule 3). */
export function CyclePosition() {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let frame = 0
    const draw = () => {
      if (ref.current) ref.current.textContent = getCycle().toFixed(2)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <span className="font-mono text-knob-value text-text-2">
      cycle <span ref={ref}>0.00</span>
    </span>
  )
}
