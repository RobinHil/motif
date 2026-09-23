import type { GeneratedCode } from '../codegen/generate'
import type { ID } from '../model/project'
import { describeError, type BlockIssue } from './check-block'

export interface EngineBackend {
  /** Checks one track block alone, without playing it. */
  checkBlock(block: string): Promise<BlockIssue | null>
  /** Evaluates the whole program. Resolves to the error, or null when Strudel accepted it. */
  evaluate(code: string): Promise<unknown>
}

export interface EvaluationResult {
  /** The program handed to Strudel: failing blocks are replaced by their last valid version. */
  code: string
  /** Errors per track. `line` is a line of the generated code (GeneratedCode.code), 1-based. */
  errors: Record<ID, BlockIssue>
  /** An error that could not be attached to a track. The previous pattern keeps playing. */
  globalError: string | null
  /** Whether Strudel accepted the program. */
  applied: boolean
}

export const EVALUATION_DEBOUNCE_MS = 150

/**
 * Turns generated code into what Strudel plays, so that a code error never stops the sound
 * (golden rule 6): each block is checked alone first, a failing track keeps playing its last valid
 * block while the others update, and if Strudel still rejects the program the previous pattern
 * keeps playing. UI changes are debounced (SPEC 5).
 */
export class Evaluator {
  private readonly lastValid = new Map<ID, string>()
  private pending: GeneratedCode | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly backend: EngineBackend,
    private readonly onResult: (result: EvaluationResult) => void,
    private readonly debounceMs = EVALUATION_DEBOUNCE_MS,
  ) {}

  /** Evaluates `generated` after the debounce delay; a newer call replaces an older pending one. */
  schedule(generated: GeneratedCode): void {
    this.pending = generated
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), this.debounceMs)
  }

  get hasPending(): boolean {
    return this.pending !== null
  }

  /** Evaluates the pending program now. Evaluations never overlap. */
  flush(): Promise<EvaluationResult | null> {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    const generated = this.pending
    this.pending = null
    if (generated === null) return this.queue.then(() => null)
    const run = this.queue.then(() => this.run(generated))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async run(generated: GeneratedCode): Promise<EvaluationResult> {
    const errors: Record<ID, BlockIssue> = {}
    const accepted = new Map<ID, string>()
    const blocks: string[] = []

    for (const { trackId, code } of generated.blocks) {
      const issue = await this.backend.checkBlock(code)
      if (issue === null) {
        accepted.set(trackId, code)
        blocks.push(code)
        continue
      }
      const from = generated.lineMap[trackId]?.from
      errors[trackId] =
        issue.line !== undefined && from !== undefined
          ? { message: issue.message, line: from + issue.line - 1 }
          : { message: issue.message }
      const previous = this.lastValid.get(trackId)
      if (previous !== undefined) blocks.push(previous)
    }

    const code = `${[generated.header, ...(blocks.length > 0 ? ['', ...blocks] : [])].join('\n')}\n`
    const failure = await this.backend.evaluate(code)
    let globalError: string | null = null
    if (failure === null) {
      const present = new Set(generated.blocks.map((b) => b.trackId))
      for (const id of this.lastValid.keys()) if (!present.has(id)) this.lastValid.delete(id)
      for (const [id, block] of accepted) this.lastValid.set(id, block)
    } else {
      globalError = describeError(failure).message
    }

    const result: EvaluationResult = { code, errors, globalError, applied: failure === null }
    this.onResult(result)
    return result
  }
}
