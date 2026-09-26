// Live highlighting (SPEC 6.6, SPIKE 3): the mini-notation elements sounding now are outlined in
// every editor showing the program being played, in the color of their track.
import type { GeneratedCode } from '../codegen/generate'
import type { CodeView, PlayMark } from '../components/code-view'
import { activeLocations, evaluatedProgram } from '../engine/engine'
import type { Project } from '../model/project'
import { codeStore } from '../store/code-store'
import { projectStore } from '../store/project-store'
import { uiStore } from '../store/ui-store'
import { onFrame } from '../viz/frame-loop'

const views = new Set<CodeView>()

export function watchView(view: CodeView): () => void {
  views.add(view)
  return () => views.delete(view)
}

/** Colors each position by the track whose block contains it. */
export function playMarks(
  locations: readonly [number, number][],
  generated: GeneratedCode,
  project: Project,
): PlayMark[] {
  const lineStarts: number[] = [0]
  for (let index = 0; index < generated.code.length; index++)
    if (generated.code[index] === '\n') lineStarts.push(index + 1)
  const lineOf = (offset: number) => {
    let line = 0
    while (line + 1 < lineStarts.length && (lineStarts[line + 1] ?? 0) <= offset) line++
    return line + 1
  }
  const colorOf = new Map(project.tracks.map((t) => [t.id, Number(t.color.slice(-1))]))
  return locations.flatMap(([from, to]) => {
    const line = lineOf(from)
    const trackId = Object.entries(generated.lineMap).find(([, r]) => line >= r.from && line <= r.to)?.[0]
    return trackId ? [{ from, to, color: colorOf.get(trackId) ?? 1 }] : []
  })
}

export function startLiveHighlight(): () => void {
  let program: ReturnType<typeof evaluatedProgram> = null
  const marked = new WeakMap<CodeView, string>()
  const lastActive = new WeakMap<CodeView, string>()

  return onFrame(() => {
    const current = evaluatedProgram()
    const generated = codeStore.getState().generated
    if (current !== program) program = current

    // Positions are only valid on the exact program Strudel is playing.
    const source =
      program !== null && generated !== null && program.code === generated.code ? { program, generated } : null
    const text = source?.program.code.replace(/\n$/, '')
    const showing = new Set([...views].filter((view) => text !== undefined && view.text === text))

    // Querying the pattern every frame is not free: only when an editor shows the program.
    const enabled = uiStore.getState().liveHighlight && showing.size > 0
    const active = enabled ? activeLocations() : new Set<string>()
    const activeKey = [...active].sort().join(',')

    for (const view of views) {
      const matches = source !== null && showing.has(view)
      const key = matches ? source.program.code : ''
      if (marked.get(view) !== key) {
        marked.set(view, key)
        view.setPlayMarks(
          matches ? playMarks(source.program.locations, source.generated, projectStore.getState().project) : [],
        )
      }
      const shown = matches ? activeKey : ''
      if (lastActive.get(view) !== shown) {
        lastActive.set(view, shown)
        view.setActive(matches ? active : new Set())
      }
    }
  })
}
