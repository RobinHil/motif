import { paramValueCode } from '../../codegen/params'
import type { ID, ParamKey, ParamValue } from '../../model/project'
import { useCode } from '../../store/code-store'

/** The track's generated block, with the animated parameter's call marked. */
export function ModulationCode({
  trackId,
  paramKey,
  value,
}: {
  trackId: ID
  paramKey: ParamKey
  value: ParamValue | undefined
}) {
  const block = useCode((s) => s.generated?.blocks.find((b) => b.trackId === trackId)?.code)
  if (!block) return null
  const call = value === undefined ? '' : `.${paramKey}(${paramValueCode(value)})`
  const at = call ? block.indexOf(call) : -1
  return (
    <pre
      aria-label="Track code"
      className="rounded-panel bg-bg-code px-5 py-4 font-mono text-code-lg break-all whitespace-pre-wrap text-text"
    >
      {at < 0 ? (
        block
      ) : (
        <>
          {block.slice(0, at)}
          <mark className="rounded-xs bg-mod-bg px-0.5 text-mod">{call}</mark>
          {block.slice(at + call.length)}
        </>
      )}
    </pre>
  )
}
