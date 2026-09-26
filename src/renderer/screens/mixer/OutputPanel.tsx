import { toggleOutputRecording } from '../../app/export-session'
import { outputSampleRate } from '../../engine/engine'
import { recordingStore, useRecording } from '../../store/recording-store'
import { OutputScope } from '../../viz/OutputScope'

/** Output panel (SPEC 6.2): spectrum, oscilloscope, recording of the output. */
export function OutputPanel() {
  const bitDepth = useRecording((s) => s.bitDepth)
  const stems = useRecording((s) => s.stems)
  const recording = useRecording((s) => s.recording)
  // Files are written at the rate the audio runs at, usually 48 kHz.
  const rate = String(Math.round((outputSampleRate() ?? 48000) / 100) / 10)
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
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-body text-text-2">Recording</legend>
        <label className="flex flex-col gap-1.5 text-body text-text-2">
          Format
          <select
            value={bitDepth}
            disabled={recording}
            onChange={(event) => recordingStore.getState().set({ bitDepth: Number(event.target.value) as 16 | 24 })}
            className="h-9 rounded-input border border-line-strong bg-bg-code px-2 text-body text-text"
          >
            <option value={24}>WAV {rate} kHz 24-bit</option>
            <option value={16}>WAV {rate} kHz 16-bit</option>
          </select>
        </label>
        <label className="flex items-center gap-2.5 text-body">
          <input
            type="checkbox"
            checked={stems}
            disabled={recording}
            onChange={(event) => recordingStore.getState().set({ stems: event.target.checked })}
            className="size-4 accent-accent"
          />{' '}
          One file per orbit (stems)
        </label>
        <label
          className="flex items-center gap-2.5 text-body text-text-2"
          title="Offline render comes in a later version"
        >
          <input type="checkbox" disabled className="size-4" /> Offline render
        </label>
        <button
          type="button"
          aria-pressed={recording}
          onClick={() => void toggleOutputRecording()}
          className={`flex h-10 items-center justify-center gap-2 rounded-pill border text-body ${recording ? 'border-danger text-text' : 'border-line-strong hover:bg-raised'}`}
        >
          <span className={`size-2 bg-danger ${recording ? 'rounded-xs' : 'rounded-pill'}`} />
          {recording ? 'Stop and save' : 'Record output'}
        </button>
        <p className="text-small text-text-2">
          Records what you hear until you stop. For an exact number of cycles, use Export.
        </p>
      </fieldset>
    </aside>
  )
}
