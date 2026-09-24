import { clamp } from '../../components/knob-math'
import type { AnimatableParam } from './modulation-targets'

const MAX_VALUES = 16

/** One value per cycle for a Sequence animation (`"<v1 v2 v3>"`). */
export function SequenceEditor(props: {
  values: number[]
  param: AnimatableParam
  onChange: (values: number[]) => void
}) {
  const { values, param } = props
  const replace = (index: number, value: number) => props.onChange(values.map((v, i) => (i === index ? value : v)))
  return (
    <div role="group" aria-label="Value per cycle" className="flex flex-wrap items-end gap-2">
      {values.map((value, index) => (
        <label key={index} className="flex flex-col gap-1 rounded-input bg-raised px-3 py-2">
          <span className="flex items-center justify-between gap-3 text-small text-text-2">
            Cycle {index + 1}
            {values.length > 1 && (
              <button
                type="button"
                aria-label={`Remove cycle ${String(index + 1)}`}
                onClick={() => props.onChange(values.filter((_, i) => i !== index))}
                className="text-text-3 hover:text-text"
              >
                ×
              </button>
            )}
          </span>
          <span className="flex items-baseline gap-1 font-mono text-body-lg text-mod">
            <input
              type="number"
              value={value}
              min={param.range.min}
              max={param.range.max}
              step={param.range.step}
              onChange={(event) => {
                const typed = Number(event.target.value)
                if (event.target.value !== '' && Number.isFinite(typed))
                  replace(index, clamp(typed, param.range.min, param.range.max))
              }}
              className="field-sizing-content min-w-[3ch] [appearance:textfield] bg-transparent outline-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {param.unit && <span className="text-small text-text-2">{param.unit}</span>}
          </span>
        </label>
      ))}
      {values.length < MAX_VALUES && (
        <button
          type="button"
          onClick={() => props.onChange([...values, values.at(-1) ?? param.animate[0]])}
          className="h-[58px] rounded-input border border-dashed border-line-strong px-4 text-body text-text hover:bg-active"
        >
          + Add cycle
        </button>
      )}
    </div>
  )
}
