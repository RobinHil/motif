// One requestAnimationFrame loop shared by everything that animates (meters, playheads, position).
// Drawing happens outside React: callbacks write to canvases or DOM nodes held in refs.
type FrameCallback = (time: number) => void

const callbacks = new Set<FrameCallback>()
let frame = 0

function tick(time: number) {
  for (const callback of callbacks) callback(time)
  frame = callbacks.size > 0 ? requestAnimationFrame(tick) : 0
}

export function onFrame(callback: FrameCallback): () => void {
  callbacks.add(callback)
  if (frame === 0) frame = requestAnimationFrame(tick)
  return () => {
    callbacks.delete(callback)
    if (callbacks.size === 0 && frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }
}

/** Sizes a canvas backing store to its CSS box and device pixel ratio; returns the 2D context. */
export function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1
  const width = Math.round(canvas.clientWidth * ratio)
  const height = Math.round(canvas.clientHeight * ratio)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return context
}

/** Reads a design token (CSS custom property) once, for canvas drawing. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}
