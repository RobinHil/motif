import { PARAM_DEFAULTS } from '../model/defaults'
import { PARAM_ORDER, VOWEL, type ParamValue, type TrackParams } from '../model/project'
import { formatNumber, quote, safeToken } from './format'

/** `0.5`, `sine.range(300, 1200).slow(4)` or `"<200 800>"` (SPEC 4, rules 6 to 8). */
export function paramValueCode(value: ParamValue): string {
  if (typeof value === 'number') return formatNumber(value)
  if (value.kind === 'sequence') return quote(`<${value.values.map(formatNumber).join(' ')}>`)
  const range = `${value.shape}.range(${formatNumber(value.min)}, ${formatNumber(value.max)})`
  return value.cycles === 1 ? range : `${range}.slow(${formatNumber(value.cycles)})`
}

/** Parameter calls in the fixed order of TrackParams, skipping values equal to Strudel's default. */
export function paramsCode(params: TrackParams): string {
  let code = ''
  for (const key of PARAM_ORDER) {
    const value = params[key]
    if (value === undefined) continue
    if (key === 'vowel') {
      code += `.vowel(${quote(safeToken(value as string, VOWEL, 'vowel'))})`
      continue
    }
    const param = value as ParamValue
    if (typeof param === 'number' && PARAM_DEFAULTS[key] === param) continue
    code += `.${key}(${paramValueCode(param)})`
  }
  return code
}
