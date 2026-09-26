import { Knob, type KnobProps } from '../../components/Knob'
import type { ParamKey, Track } from '../../model/project'
import { setParam } from '../../store/actions'
import { projectStore, useProject } from '../../store/project-store'
import { uiStore } from '../../store/ui-store'
import { SWATCH } from '../studio/StudioTrackRow'
import { ANIMATABLE, animatedParams } from './modulation-targets'

/** Parameters shown for a track: the inspector's knobs, plus mixer effects the track uses. */
function shownParams(track: Track) {
  return ANIMATABLE.filter((p, i) => i < 8 || track.params[p.key] !== undefined)
}

/** Context panel of the modulation screen: the track's knobs, help, and what is animated elsewhere. */
export function ModulationSidebar({ track, target }: { track: Track; target: ParamKey }) {
  const animatedJson = useProject((s) => JSON.stringify(animatedParams(s.project.tracks)))
  const animated = JSON.parse(animatedJson) as ReturnType<typeof animatedParams>
  const { update, beginGesture, endGesture } = projectStore.getState()
  const { openModulation } = uiStore.getState()

  return (
    <aside
      aria-label="Track parameters"
      className="flex min-h-0 flex-col gap-5 overflow-y-auto rounded-panel border border-line bg-panel p-5"
    >
      <header className="flex items-center gap-3">
        <span className={`size-3.5 rounded-xs ${SWATCH[track.color]}`} />
        <h2 className="text-track-name font-medium">{track.name}</h2>
      </header>
      <ul className="grid grid-cols-2 gap-2">
        {shownParams(track).map((param) => {
          const value = track.params[param.key] as KnobProps['value']
          const active = param.key === target
          return (
            <li
              key={param.key}
              aria-current={active ? 'true' : undefined}
              onPointerDownCapture={() => openModulation(track.id, param.key)}
              onFocusCapture={() => openModulation(track.id, param.key)}
              className={`flex justify-center rounded-panel border py-3 [&>div]:w-full [&>div]:px-2 [&>div]:text-center ${active ? 'border-mod bg-mod-bg' : 'border-transparent'}`}
            >
              <Knob
                size={40}
                label={typeof value === 'object' ? `${param.label} (animated)` : param.label}
                code={param.key}
                value={value}
                range={param.range}
                defaultValue={param.defaultValue}
                color={track.color}
                onChange={(v) =>
                  update(
                    setParam(
                      track.id,
                      param.key,
                      v ?? (param.key === 'gain' || param.key === 'pan' ? param.defaultValue : undefined),
                    ),
                  )
                }
                onReset={() =>
                  update(
                    setParam(
                      track.id,
                      param.key,
                      param.key === 'gain' || param.key === 'pan' ? param.defaultValue : undefined,
                    ),
                  )
                }
                onGestureStart={beginGesture}
                onGestureEnd={endGesture}
                onAnimate={() => openModulation(track.id, param.key)}
                onFreeze={(v) => update(setParam(track.id, param.key, v))}
                midi={{ trackId: track.id, param: param.key }}
              />
            </li>
          )
        })}
      </ul>
      <p className="rounded-panel bg-raised px-4 py-3 text-body text-text-2">
        <span className="font-medium text-text">Right-click any knob → Animate.</span> The knob then moves on its own
        during playback. Right-click → Freeze to return to a fixed value.
      </p>
      <section aria-labelledby="animated-title" className="mt-auto flex flex-col gap-2">
        <h3 id="animated-title" className="text-body text-text-2">
          Already animated in this project
        </h3>
        {animated.length === 0 ? (
          <p className="text-small text-text-2">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {animated.map((a) => (
              <li key={`${a.trackId}-${a.key}`}>
                <button
                  type="button"
                  onClick={() => openModulation(a.trackId, a.key)}
                  className="flex w-full items-center justify-between rounded-input bg-raised px-3 py-2 text-body hover:bg-active"
                >
                  <span>
                    {a.trackName} · {a.label}
                  </span>
                  <span className="font-mono text-knob-value text-mod">{a.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
