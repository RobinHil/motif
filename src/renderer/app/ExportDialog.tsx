import { useEffect, useRef, useState } from 'react'
import { songLength } from '../codegen/song'
import { useProject } from '../store/project-store'
import { recordingStore, useRecording } from '../store/recording-store'
import { uiStore } from '../store/ui-store'
import { exportAudio, exportCode, exportedCode } from './export-session'
import { useCatalog } from './sound-catalog'

type What = 'audio' | 'code'

const segment = (active: boolean) =>
  `h-9 rounded-pill border px-4 text-body ${active ? 'border-text-2 bg-active text-text' : 'border-line text-text-2 hover:text-text'}`

/** Export (SPEC 9): WAV of N cycles or of the whole song, stems, or the code for strudel.cc. */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  const catalog = useCatalog()
  const scenes = useProject((s) => s.project.scenes)
  const arrangement = useProject((s) => s.project.arrangement)
  const bpm = useProject((s) => s.project.transport.bpm)
  const beats = useProject((s) => s.project.transport.beatsPerCycle)
  const bitDepth = useRecording((s) => s.bitDepth)
  const stems = useRecording((s) => s.stems)
  const exporting = useRecording((s) => s.exporting)
  const [what, setWhat] = useState<What>('audio')
  const [cycles, setCycles] = useState(8)
  const total = songLength({ scenes, arrangement } as Parameters<typeof songLength>[0])
  const [song, setSong] = useState(total > 0)
  const [error, setError] = useState<string | null>(null)
  const length = song && total > 0 ? total : cycles
  const seconds = (length * 60 * beats) / bpm

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    firstRef.current?.focus()
  }, [])

  const finish = (message: string | null) => {
    if (message) uiStore.getState().setNotice(message)
    ref.current?.close()
  }

  const run = async () => {
    setError(null)
    try {
      if (what === 'code') finish(await exportCode(song && total > 0, catalog))
      else
        finish(
          await exportAudio({ cycles, song: song && total > 0 }, (done) => {
            if (progress.current) progress.current.style.width = `${String(done * 100)}%`
          }),
        )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="export-title"
      onClose={onClose}
      onCancel={(event) => {
        if (exporting) event.preventDefault()
      }}
      className="m-auto w-[560px] max-w-[calc(100vw-48px)] rounded-panel border border-line-strong bg-panel p-6 text-text backdrop:bg-bg-deep/70"
    >
      <h2 id="export-title" className="mb-5 text-screen-title font-medium">
        Export
      </h2>
      <div className="flex flex-col gap-5">
        <div role="group" aria-label="What to export" className="flex gap-2">
          <button
            ref={firstRef}
            type="button"
            aria-pressed={what === 'audio'}
            onClick={() => setWhat('audio')}
            className={segment(what === 'audio')}
          >
            Audio (WAV)
          </button>
          <button
            type="button"
            aria-pressed={what === 'code'}
            onClick={() => setWhat('code')}
            className={segment(what === 'code')}
          >
            Code only (.js)
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-body text-text-2">Length</span>
          <div className="flex flex-wrap items-center gap-3">
            {total > 0 && (
              <label className="flex items-center gap-2 text-body">
                <input
                  type="radio"
                  name="length"
                  checked={song}
                  onChange={() => setSong(true)}
                  className="accent-accent"
                />
                The whole song ({total} cycles)
              </label>
            )}
            <label className="flex items-center gap-2 text-body">
              <input
                type="radio"
                name="length"
                checked={!song || total === 0}
                onChange={() => setSong(false)}
                className="accent-accent"
              />
              {what === 'code' ? 'The loop' : 'Cycles'}
            </label>
            {what === 'audio' && (
              <input
                type="number"
                aria-label="Cycles to export"
                min={1}
                max={512}
                value={cycles}
                disabled={song && total > 0}
                onChange={(event) => setCycles(Math.max(1, Math.min(512, Math.round(Number(event.target.value) || 1))))}
                className="h-9 w-20 rounded-input border border-line-strong bg-bg-code px-2 font-mono text-body outline-none disabled:text-text-3"
              />
            )}
          </div>
        </div>
        {what === 'audio' ? (
          <>
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-body">
                Format
                <select
                  aria-label="Format"
                  value={bitDepth}
                  onChange={(event) =>
                    recordingStore.getState().set({ bitDepth: Number(event.target.value) as 16 | 24 })
                  }
                  className="h-9 rounded-input border border-line-strong bg-bg-code px-2 text-body"
                >
                  <option value={24}>WAV 24-bit</option>
                  <option value={16}>WAV 16-bit</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-body">
                <input
                  type="checkbox"
                  checked={stems}
                  onChange={(event) => recordingStore.getState().set({ stems: event.target.checked })}
                  className="size-4 accent-accent"
                />
                One file per track (stems)
              </label>
            </div>
            <p className="text-small text-text-2">
              Recorded in real time from the first cycle: about {Math.ceil(seconds)} s. Stems are taken before the
              master bus.
            </p>
            {exporting && (
              <div
                className="h-2 overflow-hidden rounded-pill bg-bg-code"
                role="progressbar"
                aria-label="Export progress"
              >
                <div ref={progress} className="h-full w-0 bg-accent" />
              </div>
            )}
          </>
        ) : (
          <pre
            aria-label="Exported code"
            className="max-h-56 overflow-auto rounded-input bg-bg-code px-4 py-3 font-mono text-knob-value whitespace-pre text-text-2"
          >
            {exportedCode(song && total > 0, catalog)}
          </pre>
        )}
        {error && <p className="text-body text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => ref.current?.close()}
            className="h-9 rounded-pill border border-line-strong px-4 text-body hover:bg-raised disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void run()}
            className="h-9 rounded-pill bg-accent px-5 text-body font-medium text-bg-app hover:bg-accent-hover disabled:opacity-60"
          >
            {exporting ? 'Recording...' : what === 'audio' ? 'Export WAV' : 'Save .js'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
