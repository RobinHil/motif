import type { ID } from '../../model/project'
import { useCode } from '../../store/code-store'

/** A free code track: its block of generated code, in a dashed frame (SPEC 6.1). */
export function FreeCodePreview({ trackId }: { trackId: ID }) {
  const block = useCode((s) => s.generated?.blocks.find((b) => b.trackId === trackId)?.code)
  return (
    <div className="flex flex-col gap-2">
      <pre className="overflow-x-auto rounded-input border border-dashed border-line-strong bg-bg-code px-4 py-3 font-mono text-code text-text">
        {block ?? ''}
      </pre>
      <p className="text-body text-text-2">
        Free code block: no graphical view for this pattern, but it stays playable, mixable and arrangeable.
      </p>
    </div>
  )
}
