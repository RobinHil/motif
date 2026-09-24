// CodeMirror mounted in a shadow root, read-only (synced code) or editable (direct edit, code screen).
// CodeMirror injects its styles with <style> elements, which the production CSP blocks in a document
// but allows as adopted style sheets in a shadow root (docs/DECISIONS.md, "Live highlighting").
import { autocompletion, completionStatus, selectedCompletion, type CompletionSource } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, lineNumbers, type DecorationSet } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export interface LineRange {
  from: number
  to: number
}

/** A mini-notation position to outline while it plays, with its track color (1 to 4). */
export interface PlayMark {
  from: number
  to: number
  color: number
}

// ---- selected and failing lines ----------------------------------------------------------

const setLines = StateEffect.define<{ selected: LineRange | null; errors: readonly number[] }>()

const lineHighlights = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let decorations = value.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setLines)) continue
      const builder = new RangeSetBuilder<Decoration>()
      const { doc } = transaction.state
      const errors = new Set(effect.value.errors)
      const { selected } = effect.value
      for (let line = 1; line <= doc.lines; line++) {
        const classes = [
          selected !== null && line >= selected.from && line <= selected.to ? 'motif-selected' : '',
          errors.has(line) ? 'motif-error' : '',
        ].filter(Boolean)
        if (classes.length > 0)
          builder.add(doc.line(line).from, doc.line(line).from, Decoration.line({ class: classes.join(' ') }))
      }
      decorations = builder.finish()
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

// ---- words underlined as errors ----------------------------------------------------------

const setErrorWords = StateEffect.define<readonly LineRange[]>()

const errorWords = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let decorations = value.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorWords)) continue
      const length = transaction.state.doc.length
      decorations = Decoration.set(
        effect.value
          .filter((r) => r.from < r.to && r.to <= length)
          .map((r) => Decoration.mark({ class: 'motif-error-word' }).range(r.from, r.to)),
        true,
      )
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

// ---- live highlighting (SPIKE 3) ---------------------------------------------------------

const setPlayMarks = StateEffect.define<readonly PlayMark[]>()
const setActive = StateEffect.define<ReadonlySet<string>>()

/** One mark per mini-notation position; CodeMirror moves them when the text is edited. */
const playMarks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let marks = value.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setPlayMarks)) continue
      const length = transaction.state.doc.length
      marks = Decoration.set(
        effect.value
          .filter((m) => m.from < m.to && m.to <= length)
          .map((m) => Decoration.mark({ id: `${String(m.from)}:${String(m.to)}`, color: m.color }).range(m.from, m.to)),
        true,
      )
    }
    return marks
  },
})

const activeIds = StateField.define<ReadonlySet<string>>({
  create: () => new Set(),
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setActive)) return effect.value
    // Once edited, positions no longer match what plays.
    return transaction.docChanged ? new Set() : value
  },
})

const playing = EditorView.decorations.compute([playMarks, activeIds], (state) => {
  const active = state.field(activeIds)
  const builder = new RangeSetBuilder<Decoration>()
  if (active.size === 0) return builder.finish()
  const iterator = state.field(playMarks).iter()
  while (iterator.value) {
    const spec = iterator.value.spec as { id: string; color: number }
    if (active.has(spec.id))
      builder.add(iterator.from, iterator.to, Decoration.mark({ class: `motif-play motif-play-${String(spec.color)}` }))
    iterator.next()
  }
  return builder.finish()
})

// ---- look ----------------------------------------------------------------------------------

const highlightStyle = HighlightStyle.define([
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.propertyName],
    color: 'var(--color-code-function)',
  },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--color-code-string)' },
  { tag: [tags.number, tags.bool], color: 'var(--color-code-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--color-code-comment)' },
  { tag: [tags.labelName, tags.punctuation, tags.operator], color: 'var(--color-text-2)' },
])

const theme = EditorView.theme(
  {
    '&': {
      color: 'var(--color-text)',
      backgroundColor: 'transparent',
      fontSize: 'var(--motif-code-size, 12.5px)',
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily: "'Geist Mono', 'SF Mono', ui-monospace, monospace",
      lineHeight: 'var(--motif-code-line, 22px)',
    },
    '.cm-content': { padding: '8px 0', caretColor: 'var(--color-accent)' },
    '.cm-cursor': { borderLeftColor: 'var(--color-accent)', borderLeftWidth: '2px' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--color-text-3)' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 16px 0 20px', minWidth: '44px' },
    '.cm-line': { padding: '0 20px' },
    '.cm-activeLine': { backgroundColor: 'var(--color-selected-row)' },
    '.cm-line.motif-selected': { backgroundColor: 'var(--color-selected-row)' },
    '.cm-line.motif-error': { boxShadow: 'inset 2px 0 0 var(--color-danger)' },
    '.motif-error-word': { textDecoration: 'underline wavy var(--color-danger)', textUnderlineOffset: '3px' },
    '.motif-play': { borderRadius: '3px', outline: '2px solid var(--motif-play-color)', outlineOffset: '0' },
    '.motif-play-1': { '--motif-play-color': 'var(--color-track-1)' },
    '.motif-play-2': { '--motif-play-color': 'var(--color-track-2)' },
    '.motif-play-3': { '--motif-play-color': 'var(--color-track-3)' },
    '.motif-play-4': { '--motif-play-color': 'var(--color-track-4)' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--color-active)' },
    '.cm-tooltip': {
      backgroundColor: 'var(--color-raised)',
      border: '1px solid var(--color-line-strong)',
      borderRadius: '8px',
    },
    '.cm-tooltip-autocomplete > ul > li': { padding: '6px 12px', fontFamily: "'Geist Mono', ui-monospace, monospace" },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--color-active)',
      color: 'var(--color-accent)',
    },
    '.cm-completionDetail': {
      float: 'right',
      marginLeft: '24px',
      fontStyle: 'normal',
      color: 'var(--color-text-2)',
      fontFamily: "'Geist', system-ui, sans-serif",
    },
  },
  { dark: true },
)

export interface CodeViewOptions {
  label: string
  editable: boolean
  onChange?: (text: string) => void
  /** Ctrl+Enter (Cmd+Enter on macOS). */
  onEvaluate?: () => void
  /** The documented function under the cursor or selected in the completion list. */
  onFocusWord?: (word: string) => void
  completions?: CompletionSource
}

export class CodeView {
  readonly view: EditorView
  private applying = false

  constructor(host: HTMLElement, options: CodeViewOptions) {
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const parent = document.createElement('div')
    parent.style.height = '100%'
    root.replaceChildren(parent)

    const extensions: Extension[] = [
      EditorView.contentAttributes.of({ 'aria-label': options.label, tabindex: '0' }),
      lineNumbers(),
      javascript(),
      syntaxHighlighting(highlightStyle),
      theme,
      lineHighlights,
      errorWords,
      playMarks,
      activeIds,
      playing,
    ]
    if (options.editable) {
      extensions.push(
        history(),
        keymap.of([
          { key: 'Mod-Enter', preventDefault: true, run: () => (options.onEvaluate?.(), true) },
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !this.applying) options.onChange?.(update.state.doc.toString())
          if (update.selectionSet || update.docChanged || update.transactions.length > 0) {
            const completion = completionStatus(update.state) === 'active' ? selectedCompletion(update.state) : null
            const word = completion?.label ?? wordAt(update.state)
            if (word) options.onFocusWord?.(word)
          }
        }),
      )
      if (options.completions) extensions.push(autocompletion({ override: [options.completions], icons: false }))
    } else {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
    }

    this.view = new EditorView({ parent, root, state: EditorState.create({ doc: '', extensions }) })
  }

  get text(): string {
    return this.view.state.doc.toString()
  }

  /** Replaces the whole text without reporting it as a user change. */
  setCode(code: string): void {
    const current = this.text
    if (current === code) return
    this.applying = true
    const head = Math.min(this.view.state.selection.main.head, code.length)
    this.view.dispatch({ changes: { from: 0, to: current.length, insert: code }, selection: { anchor: head } })
    this.applying = false
  }

  highlightLines(selected: LineRange | null, errors: readonly number[], scroll = true): void {
    this.view.dispatch({ effects: setLines.of({ selected, errors }) })
    if (selected && scroll) {
      const line = this.view.state.doc.line(Math.min(selected.from, this.view.state.doc.lines))
      this.view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'nearest' }) })
    }
  }

  underline(ranges: readonly LineRange[]): void {
    this.view.dispatch({ effects: setErrorWords.of(ranges) })
  }

  setPlayMarks(marks: readonly PlayMark[]): void {
    this.view.dispatch({ effects: setPlayMarks.of(marks) })
  }

  setActive(ids: ReadonlySet<string>): void {
    this.view.dispatch({ effects: setActive.of(ids) })
  }

  goToLine(line: number): void {
    const target = this.view.state.doc.line(Math.max(1, Math.min(line, this.view.state.doc.lines)))
    this.view.dispatch({
      selection: { anchor: target.from },
      effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
    })
    this.view.focus()
  }

  focus(): void {
    this.view.focus()
  }

  destroy(): void {
    this.view.destroy()
  }
}

function wordAt(state: EditorState): string | null {
  const word = state.wordAt(state.selection.main.head)
  return word ? state.sliceDoc(word.from, word.to) : null
}
