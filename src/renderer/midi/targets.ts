// What a MIDI controller can drive (SPEC 8, MIDI learn): track parameters, the master strip and the
// tempo. Mappings live in the project (`midiMappings`), keyed by device name, channel and CC, so a
// controller that is unplugged and plugged back in finds them again. Pure.
import { fromNormalized, type KnobRange } from '../components/knob-math'
import type { MidiMapping, ParamKey, Project } from '../model/project'
import { setBpm, setMaster, setParam } from '../store/actions'
import type { Recipe } from '../store/project-store'
import { animatable } from '../screens/modulation/modulation-targets'

export type MidiTarget = MidiMapping['target']

const MASTER: Record<string, { label: string; range: KnobRange }> = {
  gain: { label: 'Master volume', range: { min: 0, max: 2, scale: 'linear', step: 0.01 } },
  width: { label: 'Master width', range: { min: 0, max: 2, scale: 'linear', step: 0.01 } },
  low: { label: 'Master low', range: { min: -12, max: 12, scale: 'linear', step: 0.5 } },
  high: { label: 'Master high', range: { min: -12, max: 12, scale: 'linear', step: 0.5 } },
  bpm: { label: 'Tempo', range: { min: 40, max: 240, scale: 'linear', step: 1 } },
}

export const TEMPO_TARGET: MidiTarget = { trackId: 'master', param: 'bpm' }
export const sameTarget = (a: MidiTarget, b: MidiTarget) => a.trackId === b.trackId && a.param === b.param

export interface TargetSpec {
  label: string
  range: KnobRange
  /** What a CC value 0 to 127 does to the project; null when the target cannot take it now. */
  apply: (value: number) => Recipe | null
}

/** The label, range and effect of a target in this project, or null when it no longer exists. */
export function targetSpec(project: Pick<Project, 'tracks'>, target: MidiTarget): TargetSpec | null {
  if (target.trackId === 'master') {
    const master = MASTER[target.param]
    if (!master) return null
    return {
      ...master,
      apply: (value) => (target.param === 'bpm' ? setBpm(value) : setMaster({ [target.param]: value })),
    }
  }
  const track = project.tracks.find((t) => t.id === target.trackId)
  const param = animatable(target.param as ParamKey)
  if (!track || !param) return null
  return {
    label: `${track.name} ${param.label.toLowerCase()}`,
    range: param.range,
    // An animated parameter is left alone, like its knob.
    apply: (value) => (typeof track.params[param.key] === 'object' ? null : setParam(track.id, param.key, value)),
  }
}

/** CC value 0 to 127 -> the parameter's value, on the knob's own scale (log for frequencies). */
export function ccValue(cc: number, range: KnobRange): number {
  return fromNormalized(Math.min(127, Math.max(0, cc)) / 127, range)
}

/** Mappings that listen to this control. */
export function mappingsFor(
  mappings: readonly MidiMapping[],
  deviceName: string,
  channel: number,
  cc: number,
): MidiMapping[] {
  return mappings.filter((m) => m.deviceName === deviceName && m.channel === channel && m.cc === cc)
}

/** Maps a control to a target: one control per target, one target per control. */
export const learnMapping =
  (mapping: MidiMapping): Recipe =>
  (project) => {
    project.midiMappings = project.midiMappings.filter(
      (m) =>
        !sameTarget(m.target, mapping.target) &&
        !(m.deviceName === mapping.deviceName && m.channel === mapping.channel && m.cc === mapping.cc),
    )
    project.midiMappings.push({ ...mapping, target: { ...mapping.target } })
  }

export const removeMapping =
  (target: MidiTarget): Recipe =>
  (project) => {
    project.midiMappings = project.midiMappings.filter((m) => !sameTarget(m.target, target))
  }
