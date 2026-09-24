import { useState } from 'react'
import { ContextMenu, type MenuPosition } from '../../components/ContextMenu'
import { Knob } from '../../components/Knob'
import { TRANSFORM_DEFAULT_ARGS } from '../../model/defaults'
import type { ID, Track } from '../../model/project'
import {
  addTransform,
  moveTransform,
  removeTransform,
  setParam,
  setTransformArg,
  setTransformEnabled,
  toggleBypass,
} from '../../store/actions'
import { projectStore } from '../../store/project-store'
import { uiStore } from '../../store/ui-store'
import { addableEffects, EFFECT_PARAMS, effectRows, type EffectRow } from './mixer-effects'

const rowKey = (row: EffectRow) => (row.kind === 'param' ? row.key : row.id)

function IconButton(props: {
  label: string
  onClick: () => void
  pressed?: boolean
  children: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={props.onClick}
      className="grid size-6 place-items-center rounded-xs text-small text-text-2 hover:bg-active hover:text-text disabled:opacity-30"
    >
      {props.children}
    </button>
  )
}

/** A strip's effect chain: stacked, bypassable, reorderable (transforms), with "+ Add effect". */
export function EffectList({ track, color }: { track: Track; color: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuPosition | null>(null)
  const { update, beginGesture, endGesture } = projectStore.getState()
  const rows = effectRows(track)
  const transforms = track.transforms
  const trackId: ID = track.id

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const key = rowKey(row)
        const expanded = open === key
        const spec = row.kind === 'param' ? EFFECT_PARAMS.find((e) => e.key === row.key) : undefined
        const transform = row.kind === 'transform' ? transforms.find((t) => t.id === row.id) : undefined
        const index = transform ? transforms.indexOf(transform) : -1
        const argKey = transform
          ? Object.keys(TRANSFORM_DEFAULT_ARGS[transform.type]).find(
              (k) => typeof TRANSFORM_DEFAULT_ARGS[transform.type][k] === 'number',
            )
          : undefined
        const argValue = transform && argKey ? transform.args[argKey] : undefined
        return (
          <div key={key} className={`rounded-control bg-raised-2 ${row.bypassed ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-1 pr-1">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : key)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-2 text-left text-body"
              >
                <span className="truncate text-text">{row.label}</span>
                <span
                  className={`truncate font-mono text-knob-value ${row.kind === 'param' && row.modulated ? 'text-mod' : 'text-text-2'}`}
                >
                  {row.kind === 'param' && row.modulated ? `~ ${row.value}` : row.bypassed ? 'off' : row.value}
                </span>
              </button>
            </div>
            {expanded && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 py-2">
                {spec && row.kind === 'param' && !row.modulated && (
                  <Knob
                    size={40}
                    label={spec.label}
                    code={spec.key}
                    value={track.params[spec.key] as number | undefined}
                    range={spec.range}
                    defaultValue={spec.defaultValue}
                    color={color}
                    onChange={(value) => update(setParam(trackId, spec.key, value ?? spec.defaultValue))}
                    onReset={() => update(setParam(trackId, spec.key, spec.initial))}
                    onGestureStart={beginGesture}
                    onGestureEnd={endGesture}
                    onAnimate={() => uiStore.getState().openModulation(trackId, spec.key)}
                    midi={{ trackId, param: spec.key }}
                  />
                )}
                {transform && argKey && typeof argValue === 'number' && (
                  <input
                    type="number"
                    aria-label={`${row.label} value`}
                    value={argValue}
                    min={transform.type === 'degradeBy' ? 0 : 1}
                    max={transform.type === 'degradeBy' ? 1 : 64}
                    step={transform.type === 'degradeBy' ? 0.05 : 1}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (Number.isFinite(value) && value > 0)
                        update(setTransformArg(trackId, transform.id, argKey, value))
                    }}
                    className="w-16 rounded-xs bg-bg-code px-1.5 py-1 text-right font-mono text-knob-value text-text outline-none"
                  />
                )}
                <div className="ml-auto flex items-center gap-0.5">
                  <IconButton
                    label={row.bypassed ? `Turn ${row.label} on` : `Bypass ${row.label}`}
                    pressed={!row.bypassed}
                    onClick={() =>
                      update(
                        row.kind === 'param'
                          ? toggleBypass(trackId, row.key)
                          : setTransformEnabled(trackId, row.id, row.bypassed),
                      )
                    }
                  >
                    {row.bypassed ? 'on' : 'off'}
                  </IconButton>
                  {transform && (
                    <>
                      <IconButton
                        label={`Move ${row.label} up`}
                        disabled={index <= 0}
                        onClick={() => update(moveTransform(trackId, transform.id, index - 1))}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label={`Move ${row.label} down`}
                        disabled={index >= transforms.length - 1}
                        onClick={() => update(moveTransform(trackId, transform.id, index + 1))}
                      >
                        ↓
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    label={`Remove ${row.label}`}
                    onClick={() => {
                      setOpen(null)
                      update(
                        row.kind === 'param' ? setParam(trackId, row.key, undefined) : removeTransform(trackId, row.id),
                      )
                      if (row.kind === 'param' && row.bypassed) update(toggleBypass(trackId, row.key))
                    }}
                  >
                    ×
                  </IconButton>
                </div>
              </div>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setMenu({ x: rect.left, y: rect.bottom + 4 })
        }}
        className="rounded-control border border-dashed border-line-strong py-2 text-body text-text-2 hover:text-text"
      >
        + Add effect
      </button>
      {menu && (
        <ContextMenu
          label={`Add an effect to ${track.name}`}
          position={menu}
          onClose={() => setMenu(null)}
          items={addableEffects(track).map((effect) =>
            effect.kind === 'param'
              ? {
                  label: effect.effect.label,
                  code: `.${effect.effect.key}(${String(effect.effect.initial)})`,
                  onSelect: () => update(setParam(trackId, effect.effect.key, effect.effect.initial)),
                }
              : {
                  label: effect.label,
                  code: `.${effect.type}()`,
                  onSelect: () => update(addTransform(trackId, effect.type)),
                },
          )}
        />
      )}
    </div>
  )
}
