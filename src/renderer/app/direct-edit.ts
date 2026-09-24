// Direct edit (SPEC 6.6): the text typed in an editor goes back into the project on Ctrl+Enter.
import { readBack, resolvePending, splitProgram } from '../codegen/read-back'
import { applyFix, type Suggestion } from '../docs/suggest'
import { evaluateNow } from '../engine/engine'
import type { ID, Project } from '../model/project'
import { setCode } from '../store/actions'
import { codeStore } from '../store/code-store'
import { projectStore } from '../store/project-store'

const trimEnd = (text: string) => text.replace(/\s+$/, '')

/** Records what the user typed; typing back the generated code clears the draft. */
export function updateDraft(text: string): void {
  const generated = codeStore.getState().generated?.code ?? ''
  codeStore.getState().setDraft(trimEnd(text) === trimEnd(generated) ? null : text)
  if (codeStore.getState().issues.length > 0) codeStore.getState().setIssues([])
}

function apply(next: Project): void {
  // One undo step for the whole read-back.
  projectStore.getState().update((draft) => {
    Object.assign(draft, next)
  })
  codeStore.getState().setDraft(null)
  codeStore.getState().setPending(null)
  codeStore.getState().setIssues([])
  void evaluateNow()
}

/** Ctrl+Enter: reads the draft back into the project, or asks what to do with what does not fit. */
export async function evaluateDraft(): Promise<void> {
  const { draft } = codeStore.getState()
  if (draft === null) {
    await evaluateNow()
    return
  }
  const result = readBack(draft, projectStore.getState().project)
  if (result.errors.length > 0) {
    codeStore.getState().setIssues(result.errors)
    return
  }
  if (result.pending.length > 0) {
    codeStore.getState().setPending(result)
    return
  }
  apply(result.project)
}

/** The user's answer to "this code no longer matches the grid". */
export function resolveConversion(choice: 'convert' | 'undo'): void {
  const pending = codeStore.getState().pending
  if (!pending) return
  apply(resolvePending(pending.project, pending.pending, choice))
}

/** Fix button: in the draft if the user is editing, otherwise in the track's free code. */
export async function fixError(trackId: ID, suggestion: Suggestion): Promise<void> {
  const { draft, generated } = codeStore.getState()
  const track = projectStore.getState().project.tracks.find((t) => t.id === trackId)
  if (draft !== null) {
    const block = splitProgram(draft).blocks.find((b) => b.orbit === track?.orbit)
    const from = block?.line ?? 1
    const to = block ? from + block.text.split('\n').length - 1 : draft.split('\n').length
    codeStore.getState().setDraft(applyFix(draft, suggestion, from, to))
    await evaluateDraft()
    return
  }
  if (track?.kind === 'code' && track.code !== undefined) {
    const lines = track.code.split('\n').length
    projectStore.getState().update(setCode(trackId, applyFix(track.code, suggestion, 1, lines)))
    return
  }
  // A structured track can only fail through a custom transform: fix it in the generated code.
  if (generated) {
    const range = generated.lineMap[trackId]
    if (range) codeStore.getState().setDraft(applyFix(generated.code, suggestion, range.from, range.to))
    await evaluateDraft()
  }
}
