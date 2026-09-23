import { evaluate, isPattern } from '@strudel/core'
import { transpiler } from '@strudel/transpiler'

export interface BlockIssue {
  message: string
  /** Line inside the block, 1-based, when Strudel reports one (syntax errors). */
  line?: number
}

const LABEL = /^\s*_?\$:\s?/

/** `$: s("bd")` -> `s("bd")`, so the block can be checked alone without registering a pattern. */
export function stripLabel(block: string): string {
  return block.replace(LABEL, '')
}

export function describeError(error: unknown): BlockIssue {
  if (error instanceof Error) {
    const loc = (error as Error & { loc?: { line?: unknown } }).loc
    const message = error.message.replace(/\s*\(\d+:\d+\)$/, '')
    return typeof loc?.line === 'number' ? { message, line: loc.line } : { message }
  }
  return { message: String(error) }
}

/**
 * Evaluates one track block on its own and queries its first cycle, which catches syntax errors,
 * unknown functions and errors raised while the pattern is queried. Needs Strudel's scope
 * (`evalScope`) to be set up. Returns null when the block is valid.
 */
export async function checkBlock(block: string): Promise<BlockIssue | null> {
  try {
    const { pattern } = await evaluate(stripLabel(block), transpiler)
    if (!isPattern(pattern)) return { message: 'This code does not produce a pattern.' }
    pattern.queryArc(0, 1)
    return null
  } catch (error) {
    return describeError(error)
  }
}
