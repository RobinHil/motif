import { useEffect, useRef, useState } from 'react'
import lockup from '../../../resources/brand/lockup-tagline.svg'
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '@shared/app-info'
import { uiStore, useUi } from '../store/ui-store'

/** About window (SPEC 11, License): version, license, Strudel and TidalCycles credits, licenses. */
export function AboutDialog() {
  const open = useUi((s) => s.aboutOpen)
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [licenses, setLicenses] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      closeRef.current?.focus()
      if (licenses === null) void window.motif.app.licenses().then(setLicenses)
    }
    if (!open && dialog.open) dialog.close()
  }, [open, licenses])

  return (
    <dialog
      ref={ref}
      aria-labelledby="about-title"
      onClose={() => uiStore.getState().setAboutOpen(false)}
      className="m-auto w-[620px] max-w-[calc(100vw-48px)] rounded-panel border border-line-strong bg-panel p-7 text-text backdrop:bg-bg-deep/70"
    >
      <img src={lockup} alt={`${APP_NAME}, ${APP_TAGLINE}`} className="h-12" />
      <h2 id="about-title" className="mt-5 text-screen-title font-medium">
        {APP_NAME} {APP_VERSION}
      </h2>
      <div className="mt-3 flex flex-col gap-2 text-body-lg text-text-2">
        <p>
          A music production app where every gesture writes Strudel code you can read and edit. Free software under the
          GNU Affero General Public License, version 3 or later.
        </p>
        <p>
          Built on <span className="text-text">Strudel</span> (strudel.cc, code at codeberg.org/uzu/strudel), the
          JavaScript port of <span className="text-text">TidalCycles</span> (tidalcycles.org). Thanks to their authors
          and communities: Motif is only possible because of them.
        </p>
        <p className="text-small text-text-2">
          The {APP_NAME} name and logo are not covered by the AGPL. Bundled samples are synthesized by {APP_NAME} and
          released under CC0.
        </p>
      </div>
      <h3 className="mt-5 mb-2 text-section font-medium uppercase tracking-[0.14em] text-label">Licenses</h3>
      <pre
        aria-label="Licenses"
        // Scrollable text must take the focus to scroll from the keyboard.
        tabIndex={0}
        className="h-56 overflow-auto rounded-input bg-bg-code px-4 py-3 font-mono text-knob-value whitespace-pre-wrap text-text-2"
      >
        {licenses ?? 'Loading...'}
      </pre>
      <div className="mt-5 flex justify-end">
        <button
          ref={closeRef}
          type="button"
          onClick={() => uiStore.getState().setAboutOpen(false)}
          className="h-9 rounded-pill border border-line-strong px-4 text-body hover:bg-raised"
        >
          Close
        </button>
      </div>
    </dialog>
  )
}
