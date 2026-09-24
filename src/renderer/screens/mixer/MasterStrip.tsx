import { useState } from 'react'
import { useMidiBinding } from '../../components/useMidiBinding'
import { MidiBadge } from '../../components/MidiBadge'
import { formatNumber } from '../../codegen/format'
import { ContextMenu, type MenuPosition } from '../../components/ContextMenu'
import { Fader } from '../../components/Fader'
import { Knob } from '../../components/Knob'
import type { KnobRange } from '../../components/knob-math'
import { masterLevels } from '../../engine/engine'
import type { MasterSettings } from '../../model/project'
import { setMaster } from '../../store/actions'
import { projectStore, useProject } from '../../store/project-store'
import { StereoMeter } from '../../viz/StereoMeter'

const MASTER_KNOBS: { key: 'width' | 'low' | 'high'; label: string; range: KnobRange; defaultValue: number }[] = [
  { key: 'width', label: 'Width', range: { min: 0, max: 2, scale: 'linear', step: 0.01 }, defaultValue: 1 },
  { key: 'low', label: 'Low', range: { min: -12, max: 12, scale: 'linear', step: 0.5 }, defaultValue: 0 },
  { key: 'high', label: 'High', range: { min: -12, max: 12, scale: 'linear', step: 0.5 }, defaultValue: 0 },
]
const GAIN_RANGE: KnobRange = { min: 0, max: 2, scale: 'linear', step: 0.01 }
const DYNAMICS = [
  { key: 'compressor', label: 'Compressor' },
  { key: 'limiter', label: 'Limiter' },
] as const

/** Summary of the master bus, which lives in the audio engine rather than in the Strudel code. */
export function masterSummary(master: MasterSettings): string {
  const parts = [`gain ${formatNumber(master.gain)}`]
  if ((master.width ?? 1) !== 1) parts.push(`width ${formatNumber(master.width ?? 1)}`)
  if ((master.low ?? 0) !== 0) parts.push(`low ${formatNumber(master.low ?? 0)} dB`)
  if ((master.high ?? 0) !== 0) parts.push(`high ${formatNumber(master.high ?? 0)} dB`)
  if (master.compressor) parts.push('compressor')
  if (master.limiter) parts.push('limiter')
  return `master bus: ${parts.join(', ')}`
}

/** The master strip (SPEC 6.2): dynamics, width and EQ on the master bus, output level. */
export function MasterStrip() {
  const master = useProject((s) => s.project.master)
  const [menu, setMenu] = useState<MenuPosition | null>(null)
  const gainCc = useMidiBinding({ trackId: 'master', param: 'gain' }).cc
  const { update, beginGesture, endGesture } = projectStore.getState()
  const change = (changes: Partial<MasterSettings>) => update(setMaster(changes))
  const off = DYNAMICS.filter((d) => !master[d.key])

  return (
    <section
      aria-label="Master strip"
      className="flex w-[196px] shrink-0 flex-col gap-4 rounded-panel border border-line bg-panel p-4"
    >
      <header className="flex items-center gap-2">
        <span className="size-3 rounded-xs bg-text" />
        <h2 className="flex-1 text-track-name font-medium">Master</h2>
        <span className="font-mono text-knob-value text-text-2">output</span>
      </header>
      <div className="flex flex-col gap-2">
        <h3 className="text-section font-medium uppercase tracking-[0.14em] text-label">Effects</h3>
        {DYNAMICS.filter((d) => master[d.key]).map((d) => (
          <div
            key={d.key}
            className="flex items-center justify-between rounded-control bg-raised-2 py-1 pr-1 pl-2.5 text-body"
          >
            <span>{d.label}</span>
            <span className="flex items-center gap-1">
              <span className="font-mono text-knob-value text-text-2">on</span>
              <button
                type="button"
                aria-label={`Remove ${d.label}`}
                title={`Remove ${d.label}`}
                onClick={() => change({ [d.key]: false })}
                className="grid size-6 place-items-center rounded-xs text-small text-text-2 hover:bg-active hover:text-text"
              >
                ×
              </button>
            </span>
          </div>
        ))}
        <button
          type="button"
          disabled={off.length === 0}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            setMenu({ x: rect.left, y: rect.bottom + 4 })
          }}
          className="rounded-control border border-dashed border-line-strong py-2 text-body text-text-2 hover:text-text disabled:opacity-40"
        >
          + Add effect
        </button>
      </div>
      <div className="flex justify-between">
        {MASTER_KNOBS.map((knob) => (
          <div key={knob.key} className="w-[54px] [&>div]:w-[54px]">
            <Knob
              size={40}
              label={knob.label}
              code={knob.key}
              value={master[knob.key] ?? knob.defaultValue}
              range={knob.range}
              defaultValue={knob.defaultValue}
              color="text"
              onChange={(value) => change({ [knob.key]: value ?? knob.defaultValue })}
              onReset={() => change({ [knob.key]: knob.defaultValue })}
              onGestureStart={beginGesture}
              onGestureEnd={endGesture}
              midi={{ trackId: 'master', param: knob.key }}
            />
          </div>
        ))}
      </div>
      <div className="flex min-h-48 flex-1 justify-center">
        <Fader
          label="Master volume"
          value={master.gain}
          range={GAIN_RANGE}
          defaultValue={0.8}
          onChange={(gain) => change({ gain })}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
          meter={<StereoMeter levels={masterLevels} label="Master" />}
          midi={{ trackId: 'master', param: 'gain' }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-body text-text">gain {formatNumber(master.gain)}</span>
        <MidiBadge cc={gainCc} />
      </div>
      <code
        title="The master bus is processed by Motif's audio engine, after Strudel"
        className="truncate rounded-control bg-bg-code px-2.5 py-2 font-mono text-knob-value text-text-2"
      >
        {masterSummary(master)}
      </code>
      {menu && (
        <ContextMenu
          label="Add a master effect"
          position={menu}
          onClose={() => setMenu(null)}
          items={off.map((d) => ({ label: d.label, onSelect: () => change({ [d.key]: true }) }))}
        />
      )}
    </section>
  )
}
