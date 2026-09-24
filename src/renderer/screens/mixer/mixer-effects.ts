// What the mixer shows as a strip's effect chain: the effect parameters present on the track, then
// its transforms in order (SPEC 6.2). Pure.
import { formatNumber } from '../../codegen/format'
import { TRANSFORMS } from '../../codegen/transforms'
import type { KnobRange } from '../../components/knob-math'
import type { ID, ParamKey, Track, TransformType } from '../../model/project'

export interface EffectParam {
  key: ParamKey
  label: string
  range: KnobRange
  defaultValue: number
  /** Value used when the effect is added. */
  initial: number
}

/** Parameters shown as effects, in the order codegen writes them. Sends (room, delay) and pan have their own knobs. */
export const EFFECT_PARAMS: EffectParam[] = [
  {
    key: 'lpf',
    label: 'Filter',
    range: { min: 50, max: 20000, scale: 'log', step: 1 },
    defaultValue: 20000,
    initial: 2000,
  },
  {
    key: 'hpf',
    label: 'High-pass',
    range: { min: 20, max: 10000, scale: 'log', step: 1 },
    defaultValue: 20,
    initial: 200,
  },
  {
    key: 'shape',
    label: 'Saturation',
    range: { min: 0, max: 1, scale: 'linear', step: 0.01 },
    defaultValue: 0,
    initial: 0.3,
  },
  {
    key: 'crush',
    label: 'Bitcrush',
    range: { min: 1, max: 16, scale: 'linear', step: 1 },
    defaultValue: 16,
    initial: 6,
  },
  {
    key: 'coarse',
    label: 'Downsample',
    range: { min: 1, max: 32, scale: 'linear', step: 1 },
    defaultValue: 1,
    initial: 4,
  },
]

/** Transforms offered by "+ Add effect", with their mixer names. */
export const EFFECT_TRANSFORMS: { type: TransformType; label: string }[] = [
  { type: 'jux', label: 'Stereo' },
  { type: 'chop', label: 'Chop' },
  { type: 'striate', label: 'Interleave' },
  { type: 'degradeBy', label: 'Random drops' },
  { type: 'ply', label: 'Repeat' },
]

export type EffectRow =
  | { kind: 'param'; key: ParamKey; label: string; value: string; modulated: boolean; bypassed: boolean }
  | { kind: 'transform'; id: ID; type: TransformType; label: string; value: string; bypassed: boolean }

function transformLabel(type: TransformType): string {
  return EFFECT_TRANSFORMS.find((t) => t.type === type)?.label ?? TRANSFORMS[type].label({})
}

export function effectRows(track: Track): EffectRow[] {
  const rows: EffectRow[] = []
  for (const effect of EFFECT_PARAMS) {
    const value = track.params[effect.key]
    if (value === undefined || typeof value === 'string') continue
    rows.push({
      kind: 'param',
      key: effect.key,
      label: effect.label,
      value: typeof value === 'number' ? formatNumber(value) : value.kind === 'signal' ? value.shape : 'sequence',
      modulated: typeof value !== 'number',
      bypassed: track.bypassed?.includes(effect.key) ?? false,
    })
  }
  for (const transform of track.transforms) {
    rows.push({
      kind: 'transform',
      id: transform.id,
      type: transform.type,
      label: transform.type === 'custom' ? 'Custom' : transformLabel(transform.type),
      value: TRANSFORMS[transform.type].code(transform.args).replace(/^\./, ''),
      bypassed: !transform.enabled,
    })
  }
  return rows
}

/** Effects that can still be added to a track. */
export function addableEffects(
  track: Track,
): ({ kind: 'param'; effect: EffectParam } | { kind: 'transform'; type: TransformType; label: string })[] {
  return [
    ...EFFECT_PARAMS.filter((e) => track.params[e.key] === undefined).map((effect) => ({
      kind: 'param' as const,
      effect,
    })),
    ...EFFECT_TRANSFORMS.filter((t) => !track.transforms.some((x) => x.type === t.type)).map((t) => ({
      kind: 'transform' as const,
      ...t,
    })),
  ]
}
