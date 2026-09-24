// Which parameters can be animated, and how a modulation is created and changed (SPEC 6.4). Pure.
import { formatNumber } from '../../codegen/format'
import { fromNormalized, toNormalized, type KnobRange } from '../../components/knob-math'
import type { Modulation, ParamKey, ParamValue } from '../../model/project'
import { EFFECT_PARAMS } from '../mixer/mixer-effects'
import { INSPECTOR_KNOBS } from '../studio/knob-specs'

export type ShapeId = Extract<Modulation, { kind: 'signal' }>['shape'] | 'sequence'

export const SHAPES: { id: ShapeId; label: string; code: string; explanation: string }[] = [
  {
    id: 'sine',
    label: 'Sine',
    code: 'sine',
    explanation: 'Rises and falls smoothly, in a loop. The classic way to make a filter breathe.',
  },
  {
    id: 'tri',
    label: 'Triangle',
    code: 'tri',
    explanation: 'Rises then falls in straight lines, like a sine with corners.',
  },
  {
    id: 'saw',
    label: 'Ramp',
    code: 'saw',
    explanation: 'Climbs from low to high, then jumps back down. Good for build-ups.',
  },
  {
    id: 'isaw',
    label: 'Reverse ramp',
    code: 'isaw',
    explanation: 'Starts high and falls to low, then jumps back up. A fading effect that repeats.',
  },
  { id: 'square', label: 'Square', code: 'square', explanation: 'Switches between low and high, half the time each.' },
  {
    id: 'perlin',
    label: 'Perlin',
    code: 'perlin',
    explanation: 'Wanders slowly and smoothly, never quite repeating. Feels alive.',
  },
  {
    id: 'rand',
    label: 'Random',
    code: 'rand',
    explanation: 'A new random value for every note, anywhere between low and high.',
  },
  {
    id: 'sequence',
    label: 'Sequence',
    code: '<...>',
    explanation: 'One value per cycle, chosen by you, played in order and then repeated.',
  },
]

export const CYCLE_LENGTHS = [1, 2, 4, 8, 16] as const

export interface AnimatableParam {
  key: ParamKey
  /** Short name, as on the knob. */
  label: string
  /** Full name, for the screen title. */
  title: string
  unit: string
  range: KnobRange
  /** What Strudel plays without the call. */
  defaultValue: number
  /** Low and high values of a new animation. */
  animate: [number, number]
}

const TITLES: Partial<Record<ParamKey, string>> = {
  lpf: 'Low-pass filter',
  hpf: 'High-pass filter',
  lpq: 'Filter resonance',
  room: 'Reverb',
  shape: 'Saturation',
}
const UNITS: Partial<Record<ParamKey, string>> = { lpf: 'Hz', hpf: 'Hz' }
const ANIMATE: Partial<Record<ParamKey, [number, number]>> = {
  gain: [0.4, 1],
  pan: [0.2, 0.8],
  lpf: [300, 1200],
  lpq: [1, 12],
  hpf: [100, 1000],
  room: [0, 0.6],
  delay: [0, 0.5],
  shape: [0, 0.6],
  crush: [4, 12],
  coarse: [1, 8],
  speed: [0.5, 1.5],
}

export const ANIMATABLE: AnimatableParam[] = [
  ...INSPECTOR_KNOBS,
  ...EFFECT_PARAMS.filter((e) => !INSPECTOR_KNOBS.some((k) => k.key === e.key)),
].map((spec) => ({
  key: spec.key,
  label: spec.label,
  title: TITLES[spec.key] ?? spec.label,
  unit: UNITS[spec.key] ?? '',
  range: spec.range,
  defaultValue: spec.defaultValue,
  animate: ANIMATE[spec.key] ?? [spec.range.min, spec.range.max],
}))

export function animatable(key: ParamKey): AnimatableParam | undefined {
  return ANIMATABLE.find((p) => p.key === key)
}

export const withUnit = (value: number, unit: string) => (unit ? `${formatNumber(value)} ${unit}` : formatNumber(value))

/** A sine between the parameter's usual animation bounds, over 4 cycles. */
export function defaultModulation(param: AnimatableParam): Modulation {
  const [min, max] = param.animate
  return { kind: 'signal', shape: 'sine', min, max, cycles: 4 }
}

/** Low and high bounds of any modulation. */
export function bounds(mod: Modulation): [number, number] {
  return mod.kind === 'signal' ? [mod.min, mod.max] : [Math.min(...mod.values), Math.max(...mod.values)]
}

export function shapeOf(mod: Modulation): ShapeId {
  return mod.kind === 'signal' ? mod.shape : 'sequence'
}

/**
 * Changes the shape and keeps the bounds. A new sequence gets four values going low, high, and two
 * in between, like SPEC's `"<200 800 1200 400>"`.
 */
export function withShape(mod: Modulation, shape: ShapeId, param: AnimatableParam): Modulation {
  const [min, max] = bounds(mod)
  if (shape === 'sequence') {
    if (mod.kind === 'sequence') return mod
    const at = (p: number) => {
      const low = toNormalized(min, param.range)
      return fromNormalized(low + (toNormalized(max, param.range) - low) * p, param.range)
    }
    return { kind: 'sequence', values: [min, at(0.6), max, at(0.3)] }
  }
  return { kind: 'signal', shape, min, max, cycles: mod.kind === 'signal' ? mod.cycles : 4 }
}

export function withBounds(mod: Modulation, low: number, high: number): Modulation {
  if (mod.kind === 'signal') return { ...mod, min: low, max: high }
  const [min, max] = bounds(mod)
  const scale = (v: number) => (max === min ? low : low + ((v - min) / (max - min)) * (high - low))
  return { kind: 'sequence', values: mod.values.map((v) => Number(scale(v).toPrecision(4))) }
}

/** Every animated parameter of the project, for the "Already animated" list. */
export function animatedParams(
  tracks: readonly { id: string; name: string; params: Partial<Record<ParamKey, ParamValue | string | undefined>> }[],
): { trackId: string; trackName: string; key: ParamKey; label: string; code: string }[] {
  return tracks.flatMap((track) =>
    ANIMATABLE.flatMap((param) => {
      const value = track.params[param.key]
      if (typeof value !== 'object') return []
      return [
        {
          trackId: track.id,
          trackName: track.name,
          key: param.key,
          label: param.label,
          code: value.kind === 'signal' ? value.shape : 'sequence',
        },
      ]
    }),
  )
}
