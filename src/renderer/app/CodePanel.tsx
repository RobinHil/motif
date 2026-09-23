import { useCode } from '../store/code-store'
import { useTransport } from '../store/transport-store'

/** The generated code, read-only, with the lines of failing tracks marked. */
export function CodePanel() {
  const generated = useCode((s) => s.generated)
  const errors = useTransport((s) => s.errors)
  const globalError = useTransport((s) => s.globalError)

  if (generated === null) return null
  const failing = new Set<number>()
  for (const [trackId, error] of Object.entries(errors)) {
    const range = generated.lineMap[trackId]
    if (!range) continue
    if (error.line !== undefined) failing.add(error.line)
    else for (let line = range.from; line <= range.to; line++) failing.add(line)
  }
  const lines = generated.code.replace(/\n$/, '').split('\n')

  return (
    <section aria-label="Generated code" className="flex flex-col gap-2 rounded-panel bg-bg-code p-4">
      <h2 className="text-section uppercase tracking-[0.14em] text-label">Code</h2>
      {globalError && (
        <p role="alert" className="text-small text-danger">
          {globalError}. The previous version keeps playing.
        </p>
      )}
      <pre className="overflow-x-auto font-mono text-code">
        {lines.map((line, index) => (
          <div key={index} className={`flex gap-4 ${failing.has(index + 1) ? 'bg-selected-row text-danger' : ''}`}>
            <span className="w-6 shrink-0 select-none text-right text-text-3">{index + 1}</span>
            <span className="whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </section>
  )
}
