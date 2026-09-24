import { useCatalog } from '../../app/sound-catalog'
import { Knob, type KnobProps } from '../../components/Knob'
import { TRANSFORMS } from '../../codegen/transforms'
import { TRANSFORM_DEFAULT_ARGS } from '../../model/defaults'
import { TRANSFORM_TYPES, type ID, type SoundSource, type TransformType } from '../../model/project'
import { addTransform, setParam, setSource, setTransformArg, setTransformEnabled } from '../../store/actions'
import { projectStore, useProject } from '../../store/project-store'
import { useUi } from '../../store/ui-store'
import { INSPECTOR_KNOBS } from './knob-specs'
import { KIND_LABEL, SWATCH } from './StudioTrackRow'

const LISTED_TRANSFORMS = TRANSFORM_TYPES.filter((t) => t !== 'custom')

/** The first numeric argument of a transform, edited in the small field next to its label. */
function mainArg(type: TransformType): string | null {
  const key = Object.keys(TRANSFORM_DEFAULT_ARGS[type]).find((k) => typeof TRANSFORM_DEFAULT_ARGS[type][k] === 'number')
  return key ?? null
}

function SoundSourceField({ trackId }: { trackId: ID }) {
  const kind = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.kind)
  const source = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.source)
  const catalog = useCatalog()
  if (!source || !kind) return null

  const current = source.type === 'bank' ? source.bank : source.name
  const options: { value: string; source: SoundSource }[] =
    kind === 'steps'
      ? catalog.banks.map((bank) => ({ value: bank, source: { type: 'bank', bank } }))
      : catalog.sounds.map((sound) => ({
          value: sound.name,
          source: { type: sound.category === 'Synths' ? 'synth' : 'sample', name: sound.name },
        }))
  if (!options.some((o) => o.value === current)) options.unshift({ value: current, source })

  return (
    <label className="flex flex-col gap-2">
      <span className="text-body text-text-2">Sound source</span>
      <select
        value={kind === 'code' ? '' : current}
        disabled={kind === 'code'}
        onChange={(event) => {
          const option = options.find((o) => o.value === event.target.value)
          if (option) projectStore.getState().update(setSource(trackId, option.source))
        }}
        className="h-10 rounded-input border border-line-strong bg-bg-code px-3 font-mono text-body text-text outline-none focus-visible:border-text-2 disabled:text-text-3"
      >
        {kind === 'code' ? (
          <option value="">Set in the code</option>
        ) : (
          options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value}
            </option>
          ))
        )}
      </select>
    </label>
  )
}

function TransformList({ trackId, color }: { trackId: ID; color: string }) {
  const transforms = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.transforms)
  if (!transforms) return null
  const { update } = projectStore.getState()

  return (
    <ul className="flex flex-col gap-2" aria-label="Transforms">
      {LISTED_TRANSFORMS.map((type) => {
        const instance = transforms.find((t) => t.type === type)
        const on = instance?.enabled ?? false
        const args = instance?.args ?? TRANSFORM_DEFAULT_ARGS[type]
        const argKey = mainArg(type)
        const argValue = argKey ? args[argKey] : undefined
        const toggle = () => {
          if (!instance) update(addTransform(trackId, type))
          else update(setTransformEnabled(trackId, instance.id, !instance.enabled))
        }
        return (
          <li
            key={type}
            className={`flex min-h-[34px] items-center gap-2 rounded-control border px-3 ${on ? 'border-line-strong bg-raised' : 'border-line'}`}
          >
            <button
              type="button"
              aria-pressed={on}
              onClick={toggle}
              className="flex flex-1 items-center justify-between gap-3 py-1.5 text-left text-body"
            >
              <span className={on ? 'text-text' : 'text-text-2'}>{TRANSFORMS[type].label(args)}</span>
              <span
                className="font-mono text-knob-value"
                style={{ color: on ? `var(--color-${color})` : 'var(--color-text-3)' }}
              >
                {TRANSFORMS[type].code(args)}
              </span>
            </button>
            {on && instance && argKey && typeof argValue === 'number' && (
              <input
                type="number"
                aria-label={`${TRANSFORMS[type].label(args)} value`}
                value={argValue}
                step={type === 'degradeBy' ? 0.05 : 1}
                min={type === 'degradeBy' ? 0 : 0.125}
                max={type === 'degradeBy' ? 1 : 64}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (Number.isFinite(value) && value > 0) update(setTransformArg(trackId, instance.id, argKey, value))
                }}
                className="w-14 rounded-xs bg-bg-code px-1.5 py-0.5 text-right font-mono text-knob-value text-text outline-none"
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Right panel: the selected track's sound, parameters and transforms (SPEC 6.1). */
export function Inspector() {
  const trackId = useUi((s) => s.selectedTrackId)
  const name = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.name)
  const kind = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.kind)
  const orbit = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.orbit)
  const color = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.color ?? 'track-1')
  const params = useProject((s) => s.project.tracks.find((t) => t.id === trackId)?.params)

  if (!trackId || !name || !kind || !params) {
    return (
      <aside aria-label="Inspector" className="border-l border-line bg-panel p-5 text-body text-text-2">
        Select a track to edit its sound.
      </aside>
    )
  }
  const { update, beginGesture, endGesture } = projectStore.getState()

  return (
    <aside
      aria-label="Inspector"
      className="flex min-h-0 flex-col gap-6 overflow-y-auto border-l border-line bg-panel p-5"
    >
      <header className="flex items-start gap-3">
        <span className={`mt-1.5 size-4 rounded-xs ${SWATCH[color]}`} />
        <div className="flex flex-col">
          <h2 className="text-screen-title font-medium">{name}</h2>
          <span className="text-body text-text-2">
            {KIND_LABEL[kind]} · orbit {orbit}
          </span>
        </div>
      </header>
      <SoundSourceField trackId={trackId} />
      <section aria-labelledby="params-title" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 id="params-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
            Parameters
          </h3>
          <span title="Animation arrives with the Modulation screen" className="text-body text-text-3">
            Animate a knob →
          </span>
        </div>
        <div className="grid grid-cols-4 gap-y-5">
          {INSPECTOR_KNOBS.map((spec) => (
            <Knob
              key={spec.key}
              label={spec.label}
              code={spec.key}
              value={params[spec.key] as KnobProps['value']}
              range={spec.range}
              defaultValue={spec.defaultValue}
              {...(spec.absentLabel ? { absentLabel: spec.absentLabel } : {})}
              color={color}
              onChange={(value) =>
                update(
                  setParam(
                    trackId,
                    spec.key,
                    value ?? (spec.key === 'gain' || spec.key === 'pan' ? spec.defaultValue : undefined),
                  ),
                )
              }
              onReset={() =>
                update(
                  setParam(
                    trackId,
                    spec.key,
                    spec.key === 'gain' || spec.key === 'pan' ? spec.defaultValue : undefined,
                  ),
                )
              }
              onGestureStart={beginGesture}
              onGestureEnd={endGesture}
            />
          ))}
        </div>
        <p className="text-body text-text-2">Right-click a knob for more. A sage ring marks an animated parameter.</p>
      </section>
      <section aria-labelledby="transforms-title" className="flex flex-col gap-3">
        <h3 id="transforms-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Transforms
        </h3>
        <TransformList trackId={trackId} color={color} />
      </section>
    </aside>
  )
}
