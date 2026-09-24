import { fromNormalized, toNormalized } from '../../components/knob-math'
import { projectStore } from '../../store/project-store'
import { withUnit, type AnimatableParam } from './modulation-targets'

const STEPS = 1000

/** Low or high value of an animation, on the knob's own scale (log for frequencies). */
export function BoundSlider(props: {
  label: string
  value: number
  param: AnimatableParam
  onChange: (value: number) => void
}) {
  const { value, param } = props
  const { beginGesture, endGesture } = projectStore.getState()
  return (
    <label className="flex flex-col gap-3">
      <span className="flex items-baseline justify-between text-body-lg">
        {props.label}
        <span className="font-mono text-mod">{withUnit(value, param.unit)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={STEPS}
        value={Math.round(toNormalized(value, param.range) * STEPS)}
        aria-valuetext={withUnit(value, param.unit)}
        onPointerDown={beginGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onChange={(event) => props.onChange(fromNormalized(Number(event.target.value) / STEPS, param.range))}
        className="w-full accent-mod"
      />
    </label>
  )
}
