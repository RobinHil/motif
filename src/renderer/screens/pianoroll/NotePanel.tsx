import type { ReactNode } from 'react'
import { noteTokenRanges } from '../../codegen/notes'
import type { ID, NoteContent, Track } from '../../model/project'
import { displayNoteName, midiToNoteName } from '../../model/scales'
import {
  addVariant,
  arpeggiate,
  humanize,
  moveNotes,
  pitchOnCycle,
  removeVariants,
  setNoteValues,
} from '../../store/note-actions'
import { projectStore } from '../../store/project-store'
import { useCode } from '../../store/code-store'
import { pianoRollStore, usePianoRoll } from './piano-roll-store'
import { contentScale, lengthLabel, noteMidi } from './roll-geometry'

function Field(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-input bg-raised-2 px-3 py-2.5">
      <span className="text-small text-text-2">{props.label}</span>
      <span className="font-mono text-body-lg whitespace-nowrap text-text">{props.children}</span>
    </div>
  )
}

function NumberField(props: { label: string; value: number; percent?: boolean; onChange: (value: number) => void }) {
  const shown = props.percent ? Math.round(props.value * 100) : props.value
  return (
    <label className="flex flex-col gap-1 rounded-input bg-raised-2 px-3 py-2.5">
      <span className="text-small text-text-2">{props.label}</span>
      <span className="flex items-center font-mono text-body-lg text-text">
        <input
          type="number"
          value={shown}
          min={0}
          max={props.percent ? 100 : 1}
          step={props.percent ? 5 : 0.05}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (Number.isFinite(value)) props.onChange(props.percent ? value / 100 : value)
          }}
          className="field-sizing-content min-w-[2ch] [appearance:textfield] bg-transparent outline-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {props.percent && '%'}
      </span>
    </label>
  )
}

/** The generated block of the track, with the selected notes highlighted. */
function CodeExcerpt({ track, content, selection }: { track: Track; content: NoteContent; selection: ID[] }) {
  const block = useCode((s) => s.generated?.blocks.find((b) => b.trackId === track.id)?.code)
  if (!block) return null
  const prefix = block.startsWith('_$: ') ? 4 : 3
  const ranges = noteTokenRanges(content)
  const marked = [
    ...new Set(
      selection
        .map((id) => ranges.get(id))
        .filter((r): r is [number, number] => r !== undefined)
        .map((r) => r.join(':')),
    ),
  ]
    .map((r) => r.split(':').map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0])
  const parts: { text: string; mark: boolean }[] = []
  let at = 0
  for (const [from, to] of marked) {
    if (from + prefix < at) continue
    parts.push(
      { text: block.slice(at, from + prefix), mark: false },
      { text: block.slice(from + prefix, to + prefix), mark: true },
    )
    at = to + prefix
  }
  parts.push({ text: block.slice(at), mark: false })
  return (
    <pre
      aria-label="Generated code"
      className="rounded-input bg-bg-code px-4 py-3 font-mono text-code break-all whitespace-pre-wrap text-text"
    >
      {parts.map((p, i) =>
        p.mark ? (
          <mark key={i} className="rounded-xs bg-active px-0.5 text-accent">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </pre>
  )
}

/** Right panel of the piano roll (SPEC 6.3): note properties, per-cycle variants, tools, code. */
export function NotePanel({ track, content }: { track: Track; content: NoteContent }) {
  const selection = usePianoRoll((s) => s.selection)
  const cycle = usePianoRoll((s) => s.editCycle)
  const scale = contentScale(content)
  const selected = content.notes.filter((n) => selection.includes(n.id))
  const note = selected[0]
  const { update } = projectStore.getState()
  const hasChord = new Set(selected.map((n) => n.step)).size < selected.length

  const pitchLabel = (() => {
    if (!note) return ''
    const midi = noteMidi(note, cycle, scale)
    const name = displayNoteName(midiToNoteName(midi))
    const pitch = pitchOnCycle(note, cycle === 'all' ? 1 : cycle)
    return typeof pitch === 'number' ? `${name} · degree ${String(pitch)}` : name
  })()

  return (
    <aside
      aria-label="Note properties"
      className="flex min-h-0 flex-col gap-6 overflow-y-auto border-l border-line bg-panel p-5"
    >
      <section aria-labelledby="note-title" className="flex flex-col gap-3">
        <h2 id="note-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          {selected.length > 1 ? `${String(selected.length)} notes selected` : 'Selected note'}
        </h2>
        {note ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pitch">{pitchLabel}</Field>
            <Field label="Length">{lengthLabel(note.length)}</Field>
            <NumberField
              label="Velocity"
              value={note.velocity}
              onChange={(velocity) => update(setNoteValues(track.id, selection, { velocity }))}
            />
            <NumberField
              label="Probability"
              value={note.probability}
              percent
              onChange={(probability) => update(setNoteValues(track.id, selection, { probability }))}
            />
          </div>
        ) : (
          <p className="text-body text-text-2">Click a note to see and change it.</p>
        )}
      </section>
      {note && (
        <section
          aria-labelledby="vary-title"
          className="flex flex-col gap-3 rounded-panel border border-line bg-raised p-4"
        >
          <h2 id="vary-title" className="text-body-lg font-medium">
            Vary per cycle
          </h2>
          <p className="text-body text-text-2">
            {note.alternatives?.length
              ? `This note plays ${[note.pitch, ...note.alternatives].map((p) => displayNoteName(midiToNoteName(noteMidi({ ...note, pitch: p, alternatives: [] }, 1, scale)))).join(', then ')}, one per cycle (dashed on the other cycles).`
              : 'The same note plays every cycle.'}{' '}
            Add variants so a loop never repeats exactly.
          </p>
          <button
            type="button"
            onClick={() => {
              update(addVariant(track.id, note.id))
              pianoRollStore.getState().set({ editCycle: (note.alternatives?.length ?? 0) + 2 })
            }}
            className="rounded-input border border-dashed border-line-strong py-2 text-body text-text hover:bg-active"
          >
            + Add variant
          </button>
          {note.alternatives?.length ? (
            <button
              type="button"
              onClick={() => update(removeVariants(track.id, note.id))}
              className="text-small text-text-2 hover:text-text"
            >
              Remove variants
            </button>
          ) : null}
        </section>
      )}
      <section aria-labelledby="tools-title" className="flex flex-col gap-2">
        <h2 id="tools-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Variation tools
        </h2>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => update(humanize(track.id, selection, Date.now() % 100000))}
          title="Varies the velocities slightly, written with .velocity()"
          className="rounded-input border border-line px-3 py-2.5 text-left text-body-lg hover:bg-raised disabled:opacity-40"
        >
          Humanize velocity
        </button>
        <div className="flex gap-2">
          {[1, -1].map((direction) => (
            <button
              key={direction}
              type="button"
              disabled={selected.length === 0}
              onClick={() => update(moveNotes(track.id, selection, 0, direction, cycle))}
              title={content.mode === 'degree' ? 'Changes the degrees in n("...")' : 'Changes the notes in note("...")'}
              className="flex-1 rounded-input border border-line px-3 py-2.5 text-left text-body-lg hover:bg-raised disabled:opacity-40"
            >
              Transpose {direction > 0 ? 'up' : 'down'} one {content.mode === 'degree' ? 'degree' : 'semitone'}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!hasChord}
          title={hasChord ? undefined : 'Select notes that start together'}
          onClick={() => update(arpeggiate(track.id, selection, scale))}
          className="rounded-input border border-line px-3 py-2.5 text-left text-body-lg hover:bg-raised disabled:opacity-40"
        >
          Arpeggiate a chord
        </button>
      </section>
      <section aria-labelledby="roll-code-title" className="mt-auto flex flex-col gap-2">
        <h2 id="roll-code-title" className="text-body text-text-2">
          Generated code
        </h2>
        <CodeExcerpt track={track} content={content} selection={selection} />
        <span className="text-small text-text-2">Velocities other than 1 are written with .velocity().</span>
      </section>
    </aside>
  )
}
