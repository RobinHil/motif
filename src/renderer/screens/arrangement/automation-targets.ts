import { fromNormalized, toNormalized } from '../../components/knob-math'
import type { Automation, Track } from '../../model/project'
import { ANIMATABLE, animatable, withUnit, type AnimatableParam } from '../modulation/modulation-targets'

/** Master automations: they apply to the whole song (gain as postgain, after the track volumes). */
export const MASTER_PARAMS = ['lpf', 'hpf', 'gain'] as const

export interface TargetOption {
  value: string
  label: string
  target: Automation['target']
}

/** Every parameter an automation can follow: the master's, then each track's animatable ones. */
export function targetOptions(tracks: readonly Pick<Track, 'id' | 'name'>[]): TargetOption[] {
  const master = MASTER_PARAMS.flatMap((key) => {
    const param = animatable(key)
    return param
      ? [
          {
            value: `master:${key}`,
            label: `Master · ${param.title} (${key})`,
            target: { trackId: 'master', param: key },
          },
        ]
      : []
  })
  const perTrack = tracks.flatMap((track) =>
    ANIMATABLE.map((param) => ({
      value: `${track.id}:${param.key}`,
      label: `${track.name} · ${param.title} (${param.key})`,
      target: { trackId: track.id, param: param.key },
    })),
  )
  return [...master, ...perTrack] as TargetOption[]
}

export const targetValue = (target: Automation['target']) => `${target.trackId}:${target.param}`

export function paramOf(automation: Automation): AnimatableParam | undefined {
  return animatable(automation.target.param)
}

/** Height 0..1 of a value in the lane, on the parameter's own scale (log for frequencies). */
export const heightOf = (value: number, param: AnimatableParam) => toNormalized(value, param.range)
export const valueAt = (height: number, param: AnimatableParam) => fromNormalized(height, param.range)
export const describeValue = (value: number, param: AnimatableParam) => withUnit(value, param.unit)
