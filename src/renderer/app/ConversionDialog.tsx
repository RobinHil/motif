import { useEffect, useRef } from 'react'
import { codeStore, useCode } from '../store/code-store'
import { resolveConversion } from './direct-edit'

/**
 * Asks what to do with hand edits the grid or piano roll cannot show (SPEC 6.6): convert the track to
 * free code (default, keeps the text) or undo the change. Closing the dialog keeps the draft as is.
 */
export function ConversionDialog() {
  const pending = useCode((s) => s.pending)
  const ref = useRef<HTMLDialogElement>(null)
  const convertRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (pending && !dialog.open) {
      dialog.showModal()
      // Converting keeps the typed text: it is the default answer.
      convertRef.current?.focus()
    }
    if (!pending && dialog.open) dialog.close()
  }, [pending])

  const names = pending?.pending.map((p) => p.trackName) ?? []

  return (
    <dialog
      ref={ref}
      aria-labelledby="conversion-title"
      onClose={() => codeStore.getState().setPending(null)}
      className="m-auto w-[480px] rounded-panel border border-line-strong bg-panel p-6 text-text backdrop:bg-bg-deep/70"
    >
      <h2 id="conversion-title" className="mb-3 text-screen-title font-medium">
        {names.length === 1 ? `${names[0] ?? ''} no longer fits its editor` : 'Some tracks no longer fit their editor'}
      </h2>
      <p className="mb-3 text-body-lg text-text-2">
        Your code is kept either way. As free code, the track plays exactly what you typed, without its grid or piano
        roll.
      </p>
      <ul className="mb-5 flex flex-col gap-1 text-body">
        {pending?.pending.map((p) => (
          <li key={p.trackId}>
            <span className="font-medium">{p.trackName}</span>: <span className="text-text-2">{p.reason}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => resolveConversion('undo')}
          className="h-10 rounded-pill border border-line-strong px-5 text-body hover:bg-raised"
        >
          Undo the change
        </button>
        <button
          ref={convertRef}
          type="button"
          onClick={() => resolveConversion('convert')}
          className="h-10 rounded-pill bg-accent px-5 text-body font-medium text-bg-app hover:bg-accent-hover"
        >
          Convert to free code
        </button>
      </div>
    </dialog>
  )
}
