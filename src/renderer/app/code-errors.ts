// Errors shown in the console and in the editors, with their line and a fix suggestion.
import type { GeneratedCode } from '../codegen/generate'
import { suggestFix, type Suggestion } from '../docs/suggest'
import type { ID, Project } from '../model/project'
import type { TrackError } from '../store/transport-store'

export interface ConsoleEntry {
  trackId: ID
  trackName: string
  /** Line in the generated code. */
  line: number
  message: string
  suggestion: Suggestion | null
  /** Character ranges of the wrong word, to underline it. */
  underline: { from: number; to: number }[]
}

export function consoleEntries(
  errors: Record<ID, TrackError>,
  generated: GeneratedCode | null,
  project: Project,
): ConsoleEntry[] {
  if (!generated) return []
  const lines = generated.code.split('\n')
  const lineStart = (line: number) => lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0)

  return Object.entries(errors).flatMap(([trackId, error]) => {
    const range = generated.lineMap[trackId]
    const track = project.tracks.find((t) => t.id === trackId)
    if (!range || !track) return []
    const suggestion = suggestFix(error.message)
    const underline: { from: number; to: number }[] = []
    let line = error.line ?? range.from
    if (suggestion) {
      const word = new RegExp(`(?<![\\w$])${suggestion.wrong.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')
      for (let n = range.from; n <= range.to; n++) {
        for (const match of (lines[n - 1] ?? '').matchAll(word)) {
          if (underline.length === 0) line = n
          const from = lineStart(n) + match.index
          underline.push({ from, to: from + suggestion.wrong.length })
        }
      }
    }
    return [
      { trackId, trackName: track.name, line, message: suggestion?.message ?? error.message, suggestion, underline },
    ]
  })
}
