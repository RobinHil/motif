import { useEffect, useRef } from 'react'
import { uiStore, useUi } from '../store/ui-store'
import { SHORTCUT_GROUPS } from './shortcuts'

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
      className="m-auto max-h-[calc(100vh-48px)] w-[820px] max-w-[calc(100vw-48px)] overflow-y-auto rounded-panel border border-line-strong bg-panel p-6 text-text backdrop:bg-bg-deep/70"
    >
      <h2 id="help-title" className="mb-4 text-screen-title font-medium">
        Keyboard shortcuts
      </h2>
      <div className="columns-2 gap-10">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} aria-label={group.title} className="mb-5 break-inside-avoid">
            <h3 className="mb-2 text-section font-medium uppercase tracking-[0.14em] text-label">{group.title}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-body">
              {group.shortcuts.map((s) => (
                <div key={s.keys} className="contents">
                  <dt className="font-mono text-knob-value text-accent">{s.keys}</dt>
                  <dd className="text-text-2">{s.action}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
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
