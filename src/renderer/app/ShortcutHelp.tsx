import { useEffect, useRef } from 'react'
import { uiStore, useUi } from '../store/ui-store'
import { SHORTCUTS } from './shortcuts'

/** The "?" overlay listing every shortcut. */
export function ShortcutHelp() {
  const open = useUi((s) => s.helpOpen)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="help-title"
      onClose={() => uiStore.getState().setHelpOpen(false)}
      className="m-auto w-[440px] rounded-panel border border-line-strong bg-panel p-6 text-text backdrop:bg-bg-deep/70"
    >
      <h2 id="help-title" className="mb-4 text-screen-title font-medium">
        Keyboard shortcuts
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body">
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="contents">
            <dt className="font-mono text-knob-value text-accent">{s.keys}</dt>
            <dd className="text-text-2">{s.action}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => uiStore.getState().setHelpOpen(false)}
        className="mt-6 h-9 rounded-pill border border-line-strong px-4 text-body hover:bg-raised"
      >
        Close
      </button>
    </dialog>
  )
}
