import { consoleEntries } from '../../app/code-errors'
import { fixError } from '../../app/direct-edit'
import { useCode } from '../../store/code-store'
import { useProject } from '../../store/project-store'
import { useTransport } from '../../store/transport-store'

/** Errors with their line and a fix suggestion (SPEC 6.6). */
export function CodeConsole() {
  const errors = useTransport((s) => s.errors)
  const globalError = useTransport((s) => s.globalError)
  const generated = useCode((s) => s.generated)
  const issues = useCode((s) => s.issues)
  const project = useProject((s) => s.project)
  const entries = consoleEntries(errors, generated, project)
  const empty = entries.length === 0 && issues.length === 0 && !globalError

  return (
    <section aria-labelledby="console-title" className="flex flex-col gap-2 border-t border-line px-5 py-4">
      <h2 id="console-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
        Console
      </h2>
      <ul aria-live="polite" className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.trackId}
            role="alert"
            className="flex items-center gap-4 rounded-input border border-danger/40 bg-danger/10 px-4 py-2.5 text-body"
          >
            <span className="shrink-0 text-danger">Line {entry.line}</span>
            <span className="flex-1 text-text">
              {entry.message} <span className="text-text-2">({entry.trackName})</span>
            </span>
            {entry.suggestion && (
              <button
                type="button"
                onClick={() => {
                  if (entry.suggestion) void fixError(entry.trackId, entry.suggestion)
                }}
                title={`Replace ${entry.suggestion.wrong} with ${entry.suggestion.right}`}
                className="h-8 shrink-0 rounded-control border border-danger/60 px-3 text-danger hover:bg-danger/15"
              >
                Fix
              </button>
            )}
          </li>
        ))}
        {issues.map((issue) => (
          <li
            key={issue}
            role="alert"
            className="rounded-input border border-danger/40 bg-danger/10 px-4 py-2.5 text-body text-text"
          >
            {issue}
          </li>
        ))}
        {globalError && (
          <li
            role="alert"
            className="rounded-input border border-danger/40 bg-danger/10 px-4 py-2.5 text-body text-text"
          >
            {globalError}
          </li>
        )}
        {empty && <li className="text-body text-text-2">No error.</li>}
      </ul>
      <p className="text-body text-text-2">Other tracks keep playing: an error never stops the sound.</p>
    </section>
  )
}
