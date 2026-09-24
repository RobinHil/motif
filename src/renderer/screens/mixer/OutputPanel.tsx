import { OutputScope } from '../../viz/OutputScope'

/** Output panel (SPEC 6.2): spectrum, oscilloscope, recording. Recording arrives with export. */
export function OutputPanel() {
  const later = 'Recording arrives with export'
  return (
    <aside
      aria-labelledby="output-title"
      className="flex w-[300px] shrink-0 flex-col gap-4 rounded-panel border border-line bg-panel p-4"
    >
      <h2 id="output-title" className="text-track-name font-medium">
        Output
      </h2>
      <div className="flex flex-col gap-2">
        <span className="text-body text-text-2">Spectrum</span>
        <OutputScope kind="spectrum" label="Output spectrum" className="h-36" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-body text-text-2">Oscilloscope</span>
        <OutputScope kind="scope" label="Output oscilloscope" className="h-24" />
      </div>
      <fieldset disabled title={later} className="flex flex-col gap-3 opacity-60">
        <legend className="mb-2 text-body text-text-2">Recording</legend>
        <label className="flex flex-col gap-1.5 text-body text-text-2">
          Format
          <select className="h-9 rounded-input border border-line-strong bg-bg-code px-2 text-body text-text">
            <option>WAV 48 kHz 24-bit</option>
          </select>
        </label>
        <label className="flex items-center gap-2.5 text-body">
          <input type="checkbox" className="size-4" /> One file per orbit (stems)
        </label>
        <label className="flex items-center gap-2.5 text-body">
          <input type="checkbox" className="size-4" /> Offline render
        </label>
        <button
          type="button"
          className="flex h-10 items-center justify-center gap-2 rounded-pill border border-line-strong text-body"
        >
          <span className="size-2 rounded-pill bg-danger" /> Record output
        </button>
        <p className="text-small text-text-3">{later}.</p>
      </fieldset>
    </aside>
  )
}
