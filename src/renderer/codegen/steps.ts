import { SOUND_NAME, type StepContent, type StepRow } from '../model/project'
import { formatNumber, safeToken } from './format'

const MIN_COLUMN_WIDTH = 2

function stepToken(row: StepRow, index: number): string {
  const step = row.steps[index]
  if (!step) return '~'
  let token = safeToken(row.sound, SOUND_NAME, 'sound name')
  if (row.variant !== undefined) token += `:${String(row.variant)}`
  // Mini-notation `?x` removes the event with probability x; the model stores the chance to play.
  if (step.probability < 1) token += `?${formatNumber(1 - step.probability)}`
  return token
}

function velocityToken(row: StepRow, index: number): string {
  const step = row.steps[index]
  return step ? formatNumber(step.velocity) : '~'
}

/** Pads every column to the widest token of that column, so the grid reads as a grid. */
function columnWidths(lines: readonly string[][]): number[] {
  const widths: number[] = []
  for (const line of lines) {
    line.forEach((token, column) => {
      widths[column] = Math.max(widths[column] ?? MIN_COLUMN_WIDTH, token.length)
    })
  }
  return widths
}

function layout(tokens: readonly string[], widths: readonly number[]): string {
  return tokens.map((token, column) => token.padEnd(widths[column] ?? MIN_COLUMN_WIDTH)).join(' ')
}

/**
 * Pattern of a step track (SPEC 4, "Step tracks").
 *
 * Default form: one multi-line backtick string, one row per layer, `indent` spaces before
 * continuation lines so the columns line up under the first row.
 *
 * When a velocity differs from 1, each row becomes its own `s(...)` inside `stack(...)`, because a
 * layered `.velocity("a b, c d")` would give every event the values of every layer (docs/DECISIONS.md).
 */
export function stepsPattern(content: StepContent, indent: number): string {
  const rows = content.rows
  if (rows.length === 0) return 's("~")'

  const sounds = rows.map((row) => row.steps.map((_, i) => stepToken(row, i)))
  const hasVelocity = rows.some((row) => row.steps.some((step) => step !== null && step.velocity !== 1))

  if (!hasVelocity) {
    const widths = columnWidths(sounds)
    const lines = sounds.map((tokens) => layout(tokens, widths))
    return `s(\`${lines.join(`,\n${' '.repeat(indent + 3)}`)}\`)`
  }

  const velocities = rows.map((row) => row.steps.map((_, i) => velocityToken(row, i)))
  const widths = columnWidths([...sounds, ...velocities])
  const lines = rows.map((row, i) => {
    const pattern = `s(\`${layout(sounds[i] ?? [], widths)}\`)`
    const rowHasVelocity = row.steps.some((step) => step !== null && step.velocity !== 1)
    return rowHasVelocity ? `${pattern}.velocity(\`${layout(velocities[i] ?? [], widths)}\`)` : pattern
  })
  return `stack(\n  ${lines.join(',\n  ')}\n)`
}
