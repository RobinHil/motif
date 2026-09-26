import { getCycle, isPlaying } from '../../engine/engine'
import { modulationAt } from '../../engine/modulation-curve'
import { fromNormalized, toNormalized } from '../../components/knob-math'
import type { Modulation, ParamKey } from '../../model/project'
import { setParam } from '../../store/actions'
import { projectStore, useProject } from '../../store/project-store'
import { useUi } from '../../store/ui-store'
import { BoundSlider } from './BoundSlider'
import { CurvePreview } from './CurvePreview'
import { ModulationCode } from './ModulationCode'
import { ModulationSidebar } from './ModulationSidebar'
import {
  ANIMATABLE,
  animatable,
  CYCLE_LENGTHS,
  defaultModulation,
  shapeOf,
  SHAPES,
  withBounds,
  withShape,
} from './modulation-targets'
import { SequenceEditor } from './SequenceEditor'

/** Modulation screen (SPEC 6.4, mockup 4-modulation.png). */
export function ModulationScreen() {
  const selectedId = useUi((s) => s.selectedTrackId)
  const chosenKey = useUi((s) => s.modulationKey)
  const firstId = useProject((s) => s.project.tracks[0]?.id)
  const track = useProject((s) => s.project.tracks.find((t) => t.id === (selectedId ?? firstId)) ?? s.project.tracks[0])
  const { update } = projectStore.getState()

  if (!track) {
    return (
      <main className="grid flex-1 place-items-center bg-bg-app">
        <p className="text-body-lg text-text-2">
          Add a track in the Studio, then right-click one of its knobs to animate it.
        </p>
      </main>
    )
  }

  const key: ParamKey =
    chosenKey && animatable(chosenKey)
      ? chosenKey
      : (ANIMATABLE.find((p) => typeof track.params[p.key] === 'object')?.key ?? 'lpf')
  const param = animatable(key) ?? ANIMATABLE[0]
  if (!param) return null
  const raw = track.params[key]
  const mod: Modulation | null = typeof raw === 'object' ? raw : null
  const shape = mod ? shapeOf(mod) : null
  const set = (next: Modulation) => update(setParam(track.id, key, next))
  const explanation = SHAPES.find((s) => s.id === shape)?.explanation

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-5 bg-bg-app p-5">
      <ModulationSidebar track={track} target={key} />
      <section
        aria-labelledby="modulation-title"
        className="flex min-h-0 flex-col gap-5 overflow-y-auto rounded-panel border border-line bg-panel px-7 py-6"
      >
        <header className="flex items-baseline gap-3">
          <h1 id="modulation-title" className="text-screen-title font-medium">
            Animate: {param.title}
          </h1>
          <span className="font-mono text-body text-text-2">
            {key} · {track.name} track
          </span>
          {mod && (
            <button
              type="button"
              onClick={() => {
                const playing = modulationAt(mod, isPlaying() ? getCycle() : 0)
                update(setParam(track.id, key, fromNormalized(toNormalized(playing, param.range), param.range)))
              }}
              className="ml-auto h-8 rounded-pill border border-line px-3.5 text-body text-text-2 hover:text-text"
            >
              Freeze
            </button>
          )}
        </header>
        <div className="flex flex-col gap-3">
          <h2 className="text-section font-medium uppercase tracking-[0.14em] text-label">Motion shape</h2>
          <div role="group" aria-label="Motion shape" className="grid grid-cols-8 gap-2">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={shape === s.id}
                title={
                  s.id === 'sequence'
                    ? `.${key}("<...>"): one value per cycle`
                    : `.${key}(${s.code}.range(low, high).slow(cycles))`
                }
                onClick={() => set(withShape(mod ?? defaultModulation(param), s.id, param))}
                className={`flex flex-col items-center gap-1 rounded-panel border px-2 py-3 ${shape === s.id ? 'border-mod bg-mod-bg text-text' : 'border-line text-text hover:bg-raised'}`}
              >
                <span className="text-body-lg">{s.label}</span>
                <span className={`font-mono text-small ${shape === s.id ? 'text-mod' : 'text-text-2'}`}>{s.code}</span>
              </button>
            ))}
          </div>
          <p className="text-body-lg text-text-2">
            {explanation ??
              `${param.label} is not animated. Pick a shape and the knob moves on its own during playback.`}
          </p>
        </div>
        {mod && (
          <>
            <CurvePreview mod={mod} unit={param.unit} />
            {mod.kind === 'signal' ? (
              <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-8">
                <BoundSlider
                  label="Low value"
                  value={mod.min}
                  param={param}
                  onChange={(v) => set(withBounds(mod, v, mod.max))}
                />
                <BoundSlider
                  label="High value"
                  value={mod.max}
                  param={param}
                  onChange={(v) => set(withBounds(mod, mod.min, v))}
                />
                <div className="flex flex-col gap-3">
                  <span className="text-body-lg">Cycle length</span>
                  <div role="group" aria-label="Cycle length" className="flex gap-1.5">
                    {CYCLE_LENGTHS.map((cycles) => (
                      <button
                        key={cycles}
                        type="button"
                        aria-pressed={mod.cycles === cycles}
                        title={cycles === 1 ? 'One cycle: .slow() is left out' : `.slow(${String(cycles)})`}
                        onClick={() => set({ ...mod, cycles })}
                        className={`h-9 rounded-input border px-3 text-body whitespace-nowrap ${mod.cycles === cycles ? 'border-mod bg-mod-bg text-text' : 'border-line text-text hover:bg-raised'}`}
                      >
                        {cycles} {cycles === 1 ? 'cycle' : 'cycles'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <SequenceEditor
                values={mod.values}
                param={param}
                onChange={(values) => set({ kind: 'sequence', values })}
              />
            )}
          </>
        )}
        <div className="flex flex-col gap-2">
          <h2 className="text-body text-text-2">What this writes in the code</h2>
          <ModulationCode trackId={track.id} paramKey={key} value={raw as Modulation | number | undefined} />
        </div>
      </section>
    </main>
  )
}
