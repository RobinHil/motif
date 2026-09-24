export interface KnobRange {
  min: number
  max: number
  /** 'log' for frequencies, so each octave takes the same distance. */
  scale: 'linear' | 'log'
  /** Smallest meaningful change, used to round values and for keyboard steps. */
  step: number
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function roundToStep(value: number, step: number): number {
  const rounded = Math.round(value / step) * step
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  return Number(rounded.toFixed(decimals))
}

/** Value -> position 0..1 on the knob. */
export function toNormalized(value: number, range: KnobRange): number {
  const v = clamp(value, range.min, range.max)
  if (range.scale === 'log') return Math.log(v / range.min) / Math.log(range.max / range.min)
  return (v - range.min) / (range.max - range.min)
}

/** Position 0..1 -> value, rounded to the step (3 significant digits on log scales). */
export function fromNormalized(position: number, range: KnobRange): number {
  const p = clamp(position, 0, 1)
  if (range.scale === 'log') {
    const value = range.min * (range.max / range.min) ** p
    return clamp(Number(value.toPrecision(3)), range.min, range.max)
  }
  return clamp(roundToStep(range.min + p * (range.max - range.min), range.step), range.min, range.max)
}

/** The arc is 270 degrees, open at the bottom: from 135 to 405 degrees, clockwise from +x. */
export const ARC_START = 135
export const ARC_SWEEP = 270

function point(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180
  return [cx + r * Math.cos(radians), cy + r * Math.sin(radians)]
}

/** SVG path of the arc between two positions 0..1. Empty when the arc has no length. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const start = ARC_START + ARC_SWEEP * clamp(Math.min(from, to), 0, 1)
  const end = ARC_START + ARC_SWEEP * clamp(Math.max(from, to), 0, 1)
  if (end - start < 0.01) return ''
  const [x1, y1] = point(cx, cy, r, start)
  const [x2, y2] = point(cx, cy, r, end)
  const large = end - start > 180 ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${String(r)} ${String(r)} 0 ${String(large)} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/** Parses what the user typed in the value field. Returns null when it is not a number. */
export function parseTyped(text: string, range: KnobRange): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(value)) return null
  return clamp(value, range.min, range.max)
}
