// Fix suggestions for unknown functions (SPEC 6.6): "lfp is not a function" -> "Did you mean lpf?".
import { FUNCTIONS, functionDoc } from './functions'

/** Edit distance where swapping two neighbor letters counts as one edit (lfp -> lpf is 1). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  const at = (i: number, j: number) => d[i]?.[j] ?? Number.POSITIVE_INFINITY
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, at(i - 2, j - 2) + 1)
      const row = d[i]
      if (row) row[j] = best
    }
  }
  return at(a.length, b.length)
}

/** The unknown name in a Strudel error, if the error is about an unknown function or variable. */
export function unknownName(message: string): string | null {
  const notFunction = /([A-Za-z_$][\w$]*) is not a function/.exec(message)
  if (notFunction?.[1]) return notFunction[1]
  const notDefined = /^([A-Za-z_$][\w$]*) is not defined/.exec(message)
  return notDefined?.[1] ?? null
}

export interface Suggestion {
  wrong: string
  right: string
  /** Shown in the console: "Unknown function lfp. Did you mean lpf (low-pass filter)?" */
  message: string
}

/** The closest documented function, if it is close enough to be a typo. */
export function suggestFix(errorMessage: string, known: readonly string[] = FUNCTIONS.map((f) => f.name)): Suggestion | null {
  const wrong = unknownName(errorMessage)
  if (wrong === null) return null
  const maxDistance = wrong.length <= 3 ? 1 : 2
  let right: string | null = null
  let best = Number.POSITIVE_INFINITY
  for (const name of known) {
    const distance = editDistance(wrong.toLowerCase(), name.toLowerCase())
    if (distance < best && distance <= maxDistance) {
      best = distance
      right = name
    }
  }
  if (right === null) return null
  const short = functionDoc(right)?.short
  return { wrong, right, message: `Unknown function ${wrong}. Did you mean ${right}${short ? ` (${short})` : ''}?` }
}

/** Replaces the wrong name by the right one, as a whole word, in lines [fromLine, toLine] of `code`. */
export function applyFix(code: string, suggestion: Suggestion, fromLine: number, toLine: number): string {
  const word = new RegExp(`(?<![\\w$])${suggestion.wrong.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')
  return code
    .split('\n')
    .map((line, index) => (index + 1 >= fromLine && index + 1 <= toLine ? line.replace(word, suggestion.right) : line))
    .join('\n')
}
