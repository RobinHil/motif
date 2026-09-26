import { useEffect, useRef, useState } from 'react'
import { sampleFileUrl, useCatalog } from '../../app/sound-catalog'
import { formatNumber } from '../../codegen/format'
import { decodeSample, previewSound } from '../../engine/engine'
import type { ID, Track } from '../../model/project'
import { useCode } from '../../store/code-store'
import { projectStore, useProject } from '../../store/project-store'
import {
  SLICE_MODES,
  setLoopAt,
  setRegion,
  setSlicing,
  suggestedCycles,
  type SliceMode,
} from '../../store/sample-actions'
import { waveformPeaks } from '../../viz/waveform'
import { SampleWaveform } from './SampleWaveform'

const PARTS = [4, 8, 16] as const
const LOOP_CYCLES = [1, 2, 4, 8, 16] as const
const MODE_TEXT: Record<SliceMode, { label: string; help: string }> = {
  slice: { label: 'Replay slices', help: 'Each event plays one slice, in the order of the pattern.' },
  splice: { label: 'Slices at tempo', help: 'Like slice, and each slice is stretched to fit its step.' },
  chop: { label: 'Chop', help: 'Cuts every event of the region into equal grains.' },
}

/** Sample sounds a track plays: its source, or the sounds of its rows. */
export function trackSampleSounds(track: Track): { name: string; variant: number }[] {
  if (track.kind === 'notes' && track.source.type === 'sample') return [{ name: track.source.name, variant: 0 }]
  if (track.kind !== 'steps') return []
  return (track.steps?.rows ?? [])
    .filter((row, i, rows) => rows.findIndex((r) => r.sound === row.sound) === i)
    .filter((row) => sampleFileUrl(row.sound) !== null)
    .map((row) => ({ name: row.sound, variant: row.variant ?? 0 }))
}

/** Sample editor (SPEC 7): region, slices with preview, fit to tempo. Edits the track's code. */
export function SampleEditor({ trackId, onClose }: { trackId: ID; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useCatalog()
  const track = useProject((s) => s.project.tracks.find((t) => t.id === trackId))
  const bpm = useProject((s) => s.project.transport.bpm)
  const beatsPerCycle = useProject((s) => s.project.transport.beatsPerCycle)
  const block = useCode((s) => s.generated?.blocks.find((b) => b.trackId === trackId)?.code)
  const sounds = track ? trackSampleSounds(track) : []
  const [chosen, setChosen] = useState(0)
  const sound = sounds[Math.min(chosen, sounds.length - 1)]
  const [variant, setVariant] = useState(sound?.variant ?? 0)
  const [audio, setAudio] = useState<{ url: string; peaks: [number, number][]; seconds: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const url = sound ? sampleFileUrl(sound.name, variant) : null
  const { update, beginGesture, endGesture } = projectStore.getState()
  const variants = useCatalogVariants(sound?.name ?? '')

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (url === null) return
    let live = true
    decodeSample(url).then(
      (buffer) => {
        if (live) setAudio({ url, peaks: waveformPeaks(buffer.getChannelData(0), 600), seconds: buffer.duration })
      },
      () => {
        if (live) setError('This sample could not be read.')
      },
    )
    return () => {
      live = false
    }
  }, [url])

  if (!track || !sound) return null
  const begin = typeof track.params.begin === 'number' ? track.params.begin : 0
  const end = typeof track.params.end === 'number' ? track.params.end : 1
  const animated = typeof track.params.begin === 'object' || typeof track.params.end === 'object'
  const slicing = track.transforms.find((t) => (SLICE_MODES as readonly string[]).includes(t.type))
  const mode = slicing ? (slicing.type as SliceMode) : null
  const parts = typeof slicing?.args['parts'] === 'number' ? slicing.args['parts'] : 8
  const loopAt = track.transforms.find((t) => t.type === 'loopAt')
  const loopCycles = typeof loopAt?.args['cycles'] === 'number' ? loopAt.args['cycles'] : null
  const peaks = audio?.url === url ? audio.peaks : null
  const seconds = audio?.url === url ? audio.seconds : 0

  const preview = (from: number, to: number) =>
    void previewSound({ s: sound.name, n: variant, begin: from, end: to }, Math.max(0.05, (to - from) * seconds))

  const pick = (position: number) => {
    if (mode && parts > 1) {
      const from = mode === 'chop' ? begin : 0
      const to = mode === 'chop' ? end : 1
      const index = Math.min(parts - 1, Math.max(0, Math.floor(((position - from) / (to - from)) * parts)))
      preview(from + ((to - from) * index) / parts, from + ((to - from) * (index + 1)) / parts)
    } else preview(begin, end)
  }

  const segment = (active: boolean) =>
    `h-8 rounded-pill border px-3 text-body ${active ? 'border-text-2 bg-active text-text' : 'border-line text-text-2 hover:text-text'}`

  return (
    <dialog
      ref={ref}
      aria-labelledby="sample-editor-title"
      onClose={onClose}
      className="m-auto w-[880px] max-w-[calc(100vw-48px)] rounded-panel border border-line-strong bg-panel p-6 text-text backdrop:bg-bg-deep/70"
    >
      <header className="mb-4 flex items-center gap-3">
        <h2 id="sample-editor-title" className="text-screen-title font-medium">
          Sample editor
        </h2>
        <span className="text-body text-text-2">{track.name}</span>
        {sounds.length > 1 && (
          <select
            aria-label="Sound"
            value={chosen}
            onChange={(event) => {
              const index = Number(event.target.value)
              setChosen(index)
              setVariant(sounds[index]?.variant ?? 0)
            }}
            className="h-8 rounded-input border border-line-strong bg-bg-code px-2 font-mono text-body outline-none"
          >
            {sounds.map((s, i) => (
              <option key={s.name} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {variants > 1 && (
          <select
            aria-label="Variant"
            value={variant}
            onChange={(event) => setVariant(Number(event.target.value))}
            className="h-8 rounded-input border border-line-strong bg-bg-code px-2 font-mono text-body outline-none"
          >
            {Array.from({ length: variants }, (_, i) => (
              <option key={i} value={i}>
                {sound.name}:{i}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto font-mono text-small text-text-2">
          {seconds > 0 ? `${formatNumber(Number(seconds.toFixed(2)))} s` : ''}
        </span>
      </header>

      {error ? (
        <p className="rounded-panel bg-bg-code p-6 text-body text-danger">{error}</p>
      ) : (
        <SampleWaveform
          peaks={peaks}
          color={track.color}
          begin={begin}
          end={end}
          slices={mode ? { parts, withinRegion: mode === 'chop' } : null}
          onRegion={(b, e) => {
            if (!animated) update(setRegion(track.id, b, e))
          }}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
          onPick={pick}
        />
      )}
      <p className="mt-2 text-small text-text-2">
        {animated
          ? 'Start or end is animated: freeze it in the Studio to drag the handles.'
          : 'Drag the handles to play part of the sample. Click the waveform to hear a slice.'}
      </p>

      <section aria-labelledby="slices-title" className="mt-5 flex flex-col gap-3">
        <h3 id="slices-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Slices
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Number of slices" className="flex gap-1.5">
            <button
              type="button"
              aria-pressed={mode === null}
              onClick={() => update(setSlicing(track.id, null, parts))}
              className={segment(mode === null)}
            >
              Off
            </button>
            {PARTS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={mode !== null && parts === p}
                onClick={() => update(setSlicing(track.id, mode ?? 'slice', p))}
                className={segment(mode !== null && parts === p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Slice mode" className="ml-4 flex gap-1.5">
            {SLICE_MODES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                title={MODE_TEXT[m].help}
                onClick={() => update(setSlicing(track.id, m, parts))}
                className={segment(mode === m)}
              >
                {MODE_TEXT[m].label} <span className="font-mono text-small text-text-2">{m}</span>
              </button>
            ))}
          </div>
        </div>
        {mode && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-small text-text-2">{MODE_TEXT[mode].help} Preview:</span>
            {Array.from({ length: parts }, (_, i) => {
              const from = mode === 'chop' ? begin : 0
              const to = mode === 'chop' ? end : 1
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Preview slice ${String(i + 1)}`}
                  onClick={() => preview(from + ((to - from) * i) / parts, from + ((to - from) * (i + 1)) / parts)}
                  className="size-7 rounded-xs border border-line font-mono text-knob-value text-text-2 hover:bg-raised hover:text-text"
                >
                  {i}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="fit-title" className="mt-5 flex flex-col gap-2">
        <h3 id="fit-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Fit to tempo
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={loopCycles !== null}
            onClick={() =>
              update(
                setLoopAt(
                  track.id,
                  loopCycles === null ? suggestedCycles(seconds * (end - begin), bpm, beatsPerCycle) : null,
                ),
              )
            }
            className={segment(loopCycles !== null)}
          >
            Fit to tempo <span className="font-mono text-small text-text-2">loopAt</span>
          </button>
          {loopCycles !== null && (
            <div role="group" aria-label="Cycles" className="flex gap-1.5">
              {LOOP_CYCLES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={loopCycles === c}
                  onClick={() => update(setLoopAt(track.id, c))}
                  className={segment(loopCycles === c)}
                >
                  {c} {c === 1 ? 'cycle' : 'cycles'}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-small text-text-2">
          {seconds > 0 &&
            `The sample lasts ${formatNumber(Number((seconds / ((60 / bpm) * beatsPerCycle)).toFixed(2)))} cycles at ${String(bpm)} BPM. `}
          loopAt changes the playback speed to fit, so the pitch changes too.
        </p>
      </section>

      <section className="mt-5 flex flex-col gap-2">
        <h3 className="text-body text-text-2">Generated code</h3>
        <pre
          aria-label="Track code"
          className="rounded-input bg-bg-code px-4 py-3 font-mono text-code break-all whitespace-pre-wrap text-text"
        >
          {block ?? ''}
        </pre>
      </section>

      <div className="mt-5 flex justify-end">
        <button
          ref={closeRef}
          type="button"
          onClick={() => ref.current?.close()}
          className="h-9 rounded-pill border border-line-strong px-4 text-body hover:bg-raised"
        >
          Done
        </button>
      </div>
    </dialog>
  )
}

function useCatalogVariants(name: string): number {
  const catalog = useCatalog()
  return catalog.sounds.find((s) => s.name === name)?.variants ?? 1
}
