import type { KnobRange } from '../../components/knob-math'
import type { ParamKey } from '../../model/project'

export interface KnobSpec {
  key: ParamKey
  label: string
  range: KnobRange
  /** What Strudel plays without the call (the knob's reset position). */
  defaultValue: number
  absentLabel?: string
}

/** The 8 knobs of the Studio inspector (SPEC 6.1), with Strudel's own defaults. */
export const INSPECTOR_KNOBS: KnobSpec[] = [
  { key: 'gain', label: 'Volume', range: { min: 0, max: 1.5, scale: 'linear', step: 0.01 }, defaultValue: 1 },
  { key: 'pan', label: 'Pan', range: { min: 0, max: 1, scale: 'linear', step: 0.01 }, defaultValue: 0.5 },
  {
    key: 'lpf',
    label: 'Filter',
    range: { min: 50, max: 20000, scale: 'log', step: 1 },
    defaultValue: 20000,
    absentLabel: 'open',
  },
  { key: 'lpq', label: 'Resonance', range: { min: 0, max: 30, scale: 'linear', step: 0.1 }, defaultValue: 1 },
  { key: 'room', label: 'Reverb', range: { min: 0, max: 1, scale: 'linear', step: 0.01 }, defaultValue: 0 },
  { key: 'delay', label: 'Delay', range: { min: 0, max: 1, scale: 'linear', step: 0.01 }, defaultValue: 0 },
  { key: 'shape', label: 'Saturation', range: { min: 0, max: 1, scale: 'linear', step: 0.01 }, defaultValue: 0 },
  { key: 'speed', label: 'Speed', range: { min: 0.25, max: 4, scale: 'log', step: 0.01 }, defaultValue: 1 },
]
