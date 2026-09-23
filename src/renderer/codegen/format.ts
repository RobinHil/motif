/** Numbers in generated code: at most 3 decimals, no trailing zeros (SPEC 4, rule 6). */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot write ${String(value)} into Strudel code`)
  const rounded = Number(value.toFixed(3))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/**
 * Guards a value written inside a mini-notation string. The model schema already enforces these
 * patterns; this second check keeps codegen from ever emitting a string that escapes its quotes.
 */
export function safeToken(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new Error(`Invalid ${what} for Strudel code: ${JSON.stringify(value)}`)
  return value
}

/** A double-quoted string literal. JSON escaping is valid JavaScript. */
export function quote(value: string): string {
  return JSON.stringify(value)
}

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
