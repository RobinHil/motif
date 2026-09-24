import { useCallback, useMemo, useRef } from 'react'
import { evaluateDraft, updateDraft } from '../../app/direct-edit'
import { ProgramEditor } from '../../app/ProgramEditor'
import type { CodeView } from '../../components/code-view'
import { codeStore, useCode } from '../../store/code-store'
import { useProject } from '../../store/project-store'
import { uiStore, useUi } from '../../store/ui-store'
import { CodeVisual } from '../../viz/CodeVisuals'
import { SWATCH } from '../studio/StudioTrackRow'
import { CodeConsole } from './CodeConsole'
import { DocsPanel } from './DocsPanel'
import { SNIPPETS } from './snippets'

const VISUALS = [
  { key: 'punchcard', label: 'Punchcard' },
  { key: 'pianoroll', label: 'Piano roll' },
  { key: 'spectrum', label: 'Spectrum' },
] as const

function Sidebar({ goToLine, insert }: { goToLine: (line: number) => void; insert: (code: string) => void }) {
  const tracks = useProject((s) => s.project.tracks)
  const lineMap = useCode((s) => s.generated?.lineMap)
  const liveHighlight = useUi((s) => s.liveHighlight)
  const visuals = useUi((s) => s.visuals)

  return (
    <aside
      aria-label="Code navigation"
      className="flex min-h-0 flex-col gap-6 overflow-y-auto border-r border-line bg-panel p-5"
    >
      <section aria-labelledby="code-tracks" className="flex flex-col gap-1.5">
        <h2 id="code-tracks" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Tracks
        </h2>
        {tracks.map((track) => {
          const line = lineMap?.[track.id]?.from
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => line !== undefined && goToLine(line)}
              className="flex items-center gap-2.5 rounded-control bg-raised-2 px-3 py-2 text-left text-body-lg hover:bg-active"
            >
              <span className={`size-3 rounded-xs ${SWATCH[track.color]}`} />
              <span className="flex-1 truncate">{track.name}</span>
              <span className="font-mono text-knob-value text-text-2">l.{line}</span>
            </button>
          )
        })}
      </section>
      <section aria-labelledby="code-snippets" className="flex flex-col gap-1.5">
        <h2 id="code-snippets" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Snippets
        </h2>
        {SNIPPETS.map((snippet) => (
          <button
            key={snippet.label}
            type="button"
            title={snippet.code}
            onClick={() => insert(snippet.code)}
            className="rounded-control border border-line px-3 py-2 text-left text-body-lg hover:bg-raised"
          >
            {snippet.label}
          </button>
        ))}
      </section>
      <section aria-labelledby="code-visuals" className="flex flex-col gap-2">
        <h2 id="code-visuals" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Visualizations
        </h2>
        <label className="flex items-center gap-3 text-body-lg">
          <input
            type="checkbox"
            checked={liveHighlight}
            onChange={(e) => uiStore.getState().setLiveHighlight(e.target.checked)}
            className="size-4 accent-accent"
          />
          Live highlighting
        </label>
        {VISUALS.map((v) => (
          <label key={v.key} className="flex items-center gap-3 text-body-lg">
            <input
              type="checkbox"
              checked={visuals[v.key]}
              onChange={(e) => uiStore.getState().setVisual(v.key, e.target.checked)}
              className="size-4 accent-accent"
            />
            {v.label}
          </label>
        ))}
      </section>
    </aside>
  )
}

/** Code editor screen (SPEC 6.6, mockup 6-code.png). */
export function CodeScreen() {
  const editor = useRef<CodeView | null>(null)
  const fileName = useUi((s) => s.fileName)
  const visuals = useUi((s) => s.visuals)
  const tracks = useProject((s) => s.project.tracks)
  const hasDraft = useCode((s) => s.draft !== null)
  const colors = useMemo(
    () =>
      new Map(
        tracks.map((t) => [
          t.orbit,
          getComputedStyle(document.documentElement).getPropertyValue(`--color-${t.color}`).trim(),
        ]),
      ),
    [tracks],
  )
  const onReady = useCallback((view: CodeView | null) => {
    editor.current = view
  }, [])

  const insert = (snippet: string) => {
    const { draft, generated } = codeStore.getState()
    const base = (draft ?? generated?.code ?? '').replace(/\s+$/, '')
    updateDraft(`${base}\n${snippet}\n`)
    editor.current?.goToLine(base.split('\n').length + 1)
  }

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_330px] bg-bg-app">
      <Sidebar goToLine={(line) => editor.current?.goToLine(line)} insert={insert} />
      <section
        aria-label="Code editor"
        className="flex min-h-0 flex-col bg-bg-code [--motif-code-line:24px] [--motif-code-size:14px]"
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-2.5">
          <h1 className="text-track-name font-medium">{fileName ? `${fileName}.motif` : 'Unsaved project'}</h1>
          <span className="text-body text-text-2">Ctrl+Enter to evaluate · changes flow back into the interface</span>
          {hasDraft && <span className="text-small text-accent">Edited</span>}
          <button
            type="button"
            onClick={() => void evaluateDraft()}
            className="ml-auto h-9 rounded-control bg-accent px-4 text-body font-medium text-bg-app hover:bg-accent-hover"
          >
            Evaluate
          </button>
        </header>
        <ProgramEditor editable label="Strudel code editor" onReady={onReady} highlightSelection={false} />
        {Object.values(visuals).some(Boolean) && (
          <div className="flex flex-col gap-2 border-t border-line px-5 py-3">
            {VISUALS.filter((v) => visuals[v.key]).map((v) => (
              <CodeVisual key={v.key} kind={v.key} colors={colors} />
            ))}
          </div>
        )}
        <CodeConsole />
      </section>
      <DocsPanel />
    </main>
  )
}
