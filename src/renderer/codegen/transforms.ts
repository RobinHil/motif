import { TRANSFORM_DEFAULT_ARGS } from '../model/defaults'
import type { TransformInstance, TransformType } from '../model/project'
import { formatNumber, quote } from './format'

type Args = TransformInstance['args']

function num(args: Args, key: string, type: TransformType): number {
  const value = args[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const fallback = TRANSFORM_DEFAULT_ARGS[type][key]
  return typeof fallback === 'number' ? fallback : 0
}

function str(args: Args, key: string, type: TransformType): string {
  const value = args[key]
  if (typeof value === 'string') return value
  const fallback = TRANSFORM_DEFAULT_ARGS[type][key]
  return typeof fallback === 'string' ? fallback : ''
}

interface TransformDef {
  code(args: Args): string
  /** UI label, with the argument filled in (SPEC 4, transforms table). */
  label(args: Args): string
}

const percent = (value: number) => `${formatNumber(value * 100)}%`

export const TRANSFORMS: Record<TransformType, TransformDef> = {
  fast: {
    code: (a) => `.fast(${formatNumber(num(a, 'factor', 'fast'))})`,
    label: (a) => `Speed up x${formatNumber(num(a, 'factor', 'fast'))}`,
  },
  slow: {
    code: (a) => `.slow(${formatNumber(num(a, 'factor', 'slow'))})`,
    label: (a) => `Slow down x${formatNumber(num(a, 'factor', 'slow'))}`,
  },
  rev: { code: () => '.rev()', label: () => 'Play in reverse' },
  jux: { code: () => '.jux(rev)', label: () => 'Widen stereo' },
  ply: {
    code: (a) => `.ply(${formatNumber(num(a, 'factor', 'ply'))})`,
    label: (a) =>
      num(a, 'factor', 'ply') === 2
        ? 'Double every note'
        : `Repeat every note x${formatNumber(num(a, 'factor', 'ply'))}`,
  },
  degradeBy: {
    code: (a) => `.degradeBy(${formatNumber(num(a, 'amount', 'degradeBy'))})`,
    label: (a) => `Drop ${percent(num(a, 'amount', 'degradeBy'))} at random`,
  },
  sometimes: {
    code: (a) => `.sometimes(x => x.speed(${formatNumber(num(a, 'speed', 'sometimes'))}))`,
    label: () => 'Sometimes higher',
  },
  lastOf: {
    code: (a) =>
      `.lastOf(${formatNumber(num(a, 'every', 'lastOf'))}, x => x.fast(${formatNumber(num(a, 'factor', 'lastOf'))}))`,
    label: (a) => `Faster every ${formatNumber(num(a, 'every', 'lastOf'))}th cycle`,
  },
  chop: {
    code: (a) => `.chop(${formatNumber(num(a, 'parts', 'chop'))})`,
    label: (a) => `Chop into ${formatNumber(num(a, 'parts', 'chop'))}`,
  },
  striate: { code: (a) => `.striate(${formatNumber(num(a, 'parts', 'striate'))})`, label: () => 'Interleave' },
  slice: {
    code: (a) => `.slice(${formatNumber(num(a, 'parts', 'slice'))}, ${quote(str(a, 'pattern', 'slice'))})`,
    label: () => 'Replay slices',
  },
  splice: {
    code: (a) => `.splice(${formatNumber(num(a, 'parts', 'splice'))}, ${quote(str(a, 'pattern', 'splice'))})`,
    label: () => 'Replay slices at tempo',
  },
  loopAt: {
    code: (a) => `.loopAt(${formatNumber(num(a, 'cycles', 'loopAt'))})`,
    label: (a) => `Fit to ${formatNumber(num(a, 'cycles', 'loopAt'))} cycles`,
  },
  custom: {
    code: (a) => {
      const code = str(a, 'code', 'custom').trim()
      if (code === '') return ''
      return code.startsWith('.') ? code : `.${code}`
    },
    label: () => 'Custom transform',
  },
}

/** Enabled transforms, in list order (SPEC 4, rule 4). */
export function transformsCode(transforms: readonly TransformInstance[]): string {
  return transforms
    .filter((t) => t.enabled)
    .map((t) => TRANSFORMS[t.type].code(t.args))
    .join('')
}
