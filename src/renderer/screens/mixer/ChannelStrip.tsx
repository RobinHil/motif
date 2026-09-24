import { useCallback } from 'react'
import { useMidiBinding } from '../../components/useMidiBinding'
import { MidiBadge } from '../../components/MidiBadge'
import { paramsCode } from '../../codegen/params'
import { transformsCode } from '../../codegen/transforms'
import { Fader } from '../../components/Fader'
import { Knob, type KnobProps } from '../../components/Knob'
import { trackLevels } from '../../engine/engine'
import type { ID, ParamKey } from '../../model/project'
import { setMute, setParam, setSolo } from '../../store/actions'
import { projectStore, useProject } from '../../store/project-store'
import { uiStore } from '../../store/ui-store'
import { StereoMeter } from '../../viz/StereoMeter'
import { INSPECTOR_KNOBS } from '../studio/knob-specs'
import { SWATCH } from '../studio/StudioTrackRow'
import { EffectList } from './EffectList'

const SENDS: ParamKey[] = ['room', 'delay', 'pan']
const GAIN = INSPECTOR_KNOBS.find((k) => k.key === 'gain')

export function MuteSolo({ trackId, mute, solo }: { trackId: ID; mute: boolean; solo: boolean }) {
  const { update } = projectStore.getState()
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        aria-label="Mute"
        aria-pressed={mute}
        title="Mute (_$:)"
        onClick={() => update(setMute(trackId, !mute))}
        className={`size-8 rounded-control border text-body ${mute ? 'border-danger text-danger' : 'border-line-strong text-text-2 hover:text-text'}`}
      >
        M
      </button>
      <button
        type="button"
        aria-label="Solo"
        aria-pressed={solo}
        title="Solo (_$: on the other tracks)"
        onClick={() => update(setSolo(trackId, !solo))}
        className={`size-8 rounded-control border text-body ${solo ? 'border-accent text-accent' : 'border-line-strong text-text-2 hover:text-text'}`}
      >
        S
      </button>
    </div>
  )
}

/** One mixer strip per track (SPEC 6.2, mockup 2-mixer.png). */
export function ChannelStrip({ trackId }: { trackId: ID }) {
  const track = useProject((s) => s.project.tracks.find((t) => t.id === trackId))
  const orbit = track?.orbit ?? 0
  const levels = useCallback(() => trackLevels(orbit), [orbit])
  const gainCc = useMidiBinding({ trackId, param: 'gain' }).cc
  if (!track || !GAIN) return null
  const { update, beginGesture, endGesture } = projectStore.getState()
  const gain = typeof track.params.gain === 'number' ? track.params.gain : GAIN.defaultValue
  const code = paramsCode(track.params, track.bypassed) + transformsCode(track.transforms)

  return (
    <section
      aria-label={`${track.name} strip`}
      className="flex w-[196px] shrink-0 flex-col gap-4 rounded-panel border border-line bg-panel p-4"
    >
      <header className="flex items-center gap-2">
        <span className={`size-3 rounded-xs ${SWATCH[track.color]}`} />
        <h2 className="flex-1 truncate text-track-name font-medium">{track.name}</h2>
        <span className="font-mono text-knob-value text-text-2">orbit {track.orbit}</span>
      </header>
      <div className="flex flex-col gap-2">
        <h3 className="text-section font-medium uppercase tracking-[0.14em] text-label">Effects</h3>
        <EffectList track={track} color={track.color} />
      </div>
      <div className="flex justify-between">
        {SENDS.map((key) => {
          const spec = INSPECTOR_KNOBS.find((k) => k.key === key)
          if (!spec) return null
          const required = key === 'pan'
          return (
            <div key={key} className="w-[54px] [&>div]:w-[54px]">
              <Knob
                size={40}
                label={key === 'room' ? 'Reverb' : spec.label}
                code={spec.key}
                value={track.params[key] as KnobProps['value']}
                range={spec.range}
                defaultValue={spec.defaultValue}
                color={track.color}
                onChange={(value) =>
                  update(setParam(trackId, key, value ?? (required ? spec.defaultValue : undefined)))
                }
                onReset={() => update(setParam(trackId, key, required ? spec.defaultValue : undefined))}
                onGestureStart={beginGesture}
                onGestureEnd={endGesture}
                onAnimate={() => uiStore.getState().openModulation(trackId, key)}
                midi={{ trackId, param: key }}
                onFreeze={(value) => update(setParam(trackId, key, value))}
              />
            </div>
          )
        })}
      </div>
      <div className="flex min-h-48 flex-1 justify-center">
        <Fader
          label={`${track.name} volume`}
          value={gain}
          range={GAIN.range}
          defaultValue={GAIN.defaultValue}
          onChange={(value) => update(setParam(trackId, 'gain', value))}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
          meter={<StereoMeter levels={levels} label={track.name} />}
          midi={{ trackId, param: 'gain' }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-body text-text">
          gain {typeof track.params.gain === 'number' ? track.params.gain : 'animated'}
        </span>
        <MidiBadge cc={gainCc} />
        <MuteSolo trackId={trackId} mute={track.mute} solo={track.solo} />
      </div>
      <code
        title={code}
        className="truncate rounded-control bg-bg-code px-2.5 py-2 font-mono text-knob-value text-text-2"
      >
        {code || '(no mixer code)'}
      </code>
    </section>
  )
}
