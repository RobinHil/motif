// A read-only CodeMirror view mounted in a shadow root. CodeMirror injects its styles with <style>
// elements, which the production CSP blocks in a document but allows as adopted style sheets in a
// shadow root (docs/DECISIONS.md, "Live highlighting").
import { javascript } from '@codemirror/lang-javascript'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, lineNumbers, type DecorationSet } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export interface LineRange {
  from: number
  to: number
}

const setHighlighted = StateEffect.define<{ selected: LineRange | null; errors: readonly number[] }>()

const highlightedLines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let decorations = value.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setHighlighted)) continue
      const builder = new RangeSetBuilder<Decoration>()
      const { doc } = transaction.state
      const errors = new Set(effect.value.errors)
      for (let line = 1; line <= doc.lines; line++) {
        const inSelection =
          effect.value.selected !== null && line >= effect.value.selected.from && line <= effect.value.selected.to
        const classes = [inSelection ? 'motif-selected' : '', errors.has(line) ? 'motif-error' : ''].filter(Boolean)
        if (classes.length > 0)
          builder.add(doc.line(line).from, doc.line(line).from, Decoration.line({ class: classes.join(' ') }))
      }
      decorations = builder.finish()
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

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
    '&': { color: 'var(--color-text)', backgroundColor: 'transparent', fontSize: '12.5px', height: '100%' },
    '.cm-scroller': { fontFamily: "'Geist Mono', 'SF Mono', ui-monospace, monospace", lineHeight: '22px' },
    '.cm-content': { padding: '8px 0', caretColor: 'var(--color-accent)' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--color-text-3)' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 16px 0 20px', minWidth: '44px' },
    '.cm-line': { padding: '0 20px' },
    '.cm-line.motif-selected': { backgroundColor: 'var(--color-selected-row)' },
    '.cm-line.motif-error': { boxShadow: 'inset 2px 0 0 var(--color-danger)' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--color-active)' },
  },
  { dark: true },
)

export class CodeView {
  readonly view: EditorView

  constructor(host: HTMLElement, label: string) {
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const parent = document.createElement('div')
    parent.style.height = '100%'
    root.replaceChildren(parent)
    this.view = new EditorView({
      parent,
      root,
      state: EditorState.create({
        doc: '',
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.contentAttributes.of({ 'aria-label': label, tabindex: '0' }),
          lineNumbers(),
          javascript(),
          syntaxHighlighting(highlightStyle),
          theme,
          highlightedLines,
        ],
      }),
    })
  }

  setCode(code: string): void {
    const current = this.view.state.doc.toString()
    if (current !== code) this.view.dispatch({ changes: { from: 0, to: current.length, insert: code } })
  }

  highlight(selected: LineRange | null, errors: readonly number[]): void {
    this.view.dispatch({ effects: setHighlighted.of({ selected, errors }) })
    if (selected) {
      const line = this.view.state.doc.line(Math.min(selected.from, this.view.state.doc.lines))
      this.view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'nearest' }) })
    }
  }

  destroy(): void {
    this.view.destroy()
  }
}
