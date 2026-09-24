import { useEffect, useRef } from 'react'
import { CodeView } from '../components/code-view'
import { functionDoc } from '../docs/functions'
import { codeStore, useCode } from '../store/code-store'
import { projectStore } from '../store/project-store'
import { useTransport } from '../store/transport-store'
import { useUi } from '../store/ui-store'
import { consoleEntries } from './code-errors'
import { strudelCompletions } from './completions'
import { evaluateDraft, updateDraft } from './direct-edit'
import { watchView } from './live-highlight'

/**
 * The program in CodeMirror: the generated code, or the draft being edited. Shared by the Studio
 * code panel and the code screen.
 */
export function ProgramEditor(props: {
  editable: boolean
  label: string
  onReady?: (view: CodeView | null) => void
  highlightSelection?: boolean
}) {
  const { editable, label, onReady, highlightSelection = true } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<CodeView | null>(null)
  const generated = useCode((s) => s.generated)
  const draft = useCode((s) => s.draft)
  const errors = useTransport((s) => s.errors)
  const selectedTrackId = useUi((s) => s.selectedTrackId)

  useEffect(() => {
    if (!hostRef.current) return
    const view = new CodeView(hostRef.current, {
      label,
      editable,
      onChange: updateDraft,
      onEvaluate: () => void evaluateDraft(),
      onFocusWord: (word) => {
        if (functionDoc(word)) codeStore.getState().setFocusWord(word)
      },
      completions: strudelCompletions,
    })
    viewRef.current = view
    onReady?.(view)
    const unwatch = watchView(view)
    return () => {
      unwatch()
      onReady?.(null)
      view.destroy()
      viewRef.current = null
    }
  }, [editable, label, onReady])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !generated) return
    const shown = editable && draft !== null ? draft : generated.code.replace(/\n$/, '')
    view.setCode(shown)
    // Error marks only make sense on the generated code, where the lines are known.
    const onGenerated = shown === generated.code.replace(/\n$/, '')
    const entries = onGenerated ? consoleEntries(errors, generated, projectStore.getState().project) : []
    view.highlightLines(
      highlightSelection && selectedTrackId ? (generated.lineMap[selectedTrackId] ?? null) : null,
      entries.map((e) => e.line),
      !editable,
    )
    view.underline(entries.flatMap((e) => e.underline))
  }, [generated, draft, errors, selectedTrackId, editable, highlightSelection])

  return <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
}
