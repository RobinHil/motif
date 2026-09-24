// Values of a modulated parameter over time, for the curve preview and the animated knobs. Signals
// are queried from Strudel itself, so what is drawn is what is played.
import { isaw, perlin, rand, saw, sine, square, tri, type Pattern } from '@strudel/core'
import type { Modulation } from '../model/project'

const SIGNALS = { sine, tri, saw, isaw, square, perlin, rand }
type Signal = Extract<Modulation, { kind: 'signal' }>

const patterns = new Map<string, Pattern>()

function signalPattern(mod: Signal): Pattern {
  const key = `${mod.shape} ${String(mod.min)} ${String(mod.max)} ${String(mod.cycles)}`
  let pattern = patterns.get(key)
  if (!pattern) {
    pattern = SIGNALS[mod.shape].range(mod.min, mod.max).slow(mod.cycles)
    if (patterns.size > 64) patterns.clear()
    patterns.set(key, pattern)
  }
  return pattern
}

/**
 * The value Strudel gives an event starting at `cycle`: signals are sampled at the start of each
 * event, a sequence `"<a b c>"` holds one value per cycle.
 */
export function modulationAt(mod: Modulation, cycle: number): number {
  if (mod.kind === 'sequence') {
    const index = ((Math.floor(cycle) % mod.values.length) + mod.values.length) % mod.values.length
    return mod.values[index] ?? 0
  }
  const hap = signalPattern(mod).queryArc(cycle, cycle + 1e-6)[0]
  return typeof hap?.value === 'number' ? hap.value : mod.min
}

/** `points` values evenly spread over `cycles` cycles from cycle 0. */
export function modulationCurve(mod: Modulation, cycles: number, points: number): number[] {
  return Array.from({ length: points }, (_, i) => modulationAt(mod, (i / (points - 1)) * cycles))
}
