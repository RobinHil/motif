import { useMemo } from 'react'
import { generateSongCode } from '../../codegen/song'
import type { Project } from '../../model/project'
import { useProject } from '../../store/project-store'

/** The scenes and `arrange(...)` of the song; the tracks are the Studio's blocks, as constants. */
export function SongCode() {
  const tracks = useProject((s) => s.project.tracks)
  const scenes = useProject((s) => s.project.scenes)
  const arrangement = useProject((s) => s.project.arrangement)
  const automations = useProject((s) => s.project.automations)
  const transport = useProject((s) => s.project.transport)
  const footer = useMemo(
    () =>
      generateSongCode({ tracks, scenes, arrangement, automations, transport } as Project).footer?.replace(/^\n/, '') ??
      '',
    [tracks, scenes, arrangement, automations, transport],
  )
  return (
    <section aria-labelledby="song-code-title" className="flex flex-col gap-2">
      <h2 id="song-code-title" className="text-body text-text-2">
        Generated code
      </h2>
      <pre
        aria-label="Song code"
        className="rounded-panel bg-bg-code px-6 py-4 font-mono text-code-lg whitespace-pre-wrap text-text"
      >
        {footer.split('\n').map((line, i) => (
          <span
            key={i}
            className={`block min-h-6 ${line.startsWith('//') ? 'text-code-comment' : line.startsWith('$:') || line.startsWith('  .') ? 'text-accent' : ''}`}
          >
            {line}
          </span>
        ))}
      </pre>
      <p className="text-small text-text-2">
        Each track is a constant named after it (const drums = the Drums block of the Studio, and so on).
      </p>
    </section>
  )
}
