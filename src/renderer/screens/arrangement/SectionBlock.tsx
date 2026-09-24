import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ContextMenu, type MenuPosition } from '../../components/ContextMenu'
import type { Section } from '../../codegen/song'
import { addSection, moveSection, removeSection, resizeSection } from '../../store/arrangement-actions'
import { projectStore } from '../../store/project-store'
import { cycleAt, percent } from './timeline-geometry'

const EDGE_PX = 8

/** One section of the song: drag to move, drag its right edge to resize (SPEC 6.5). */
export function SectionBlock(props: {
  section: Section
  name: string
  visible: number
  row: () => HTMLElement | null
}) {
  const { section, name, visible } = props
  const drag = useRef<{ kind: 'move' | 'resize'; grab: number } | null>(null)
  const [menu, setMenu] = useState<MenuPosition | null>(null)
  const { update, beginGesture, endGesture } = projectStore.getState()

  const at = (clientX: number) => {
    const rect = props.row()?.getBoundingClientRect()
    return rect ? cycleAt(clientX, rect, visible) : 0
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    const kind = rect.right - event.clientX <= EDGE_PX ? 'resize' : 'move'
    drag.current = { kind, grab: at(event.clientX) - section.start }
    beginGesture()
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const cycle = at(event.clientX)
    if (d.kind === 'move') update(moveSection(section.id, cycle - d.grab))
    else update(resizeSection(section.id, cycle - section.start))
  }

  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    endGesture()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (step !== 0) {
      event.preventDefault()
      update(
        event.shiftKey
          ? resizeSection(section.id, section.length + step)
          : moveSection(section.id, section.start + step),
      )
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      update(removeSection(section.id))
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      setMenu({ x: rect.left, y: rect.bottom + 4 })
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${name} section, cycles ${String(section.start)} to ${String(section.start + section.length)}. Arrows move it, Shift and arrows resize it.`}
        data-section={section.id}
        data-start={section.start}
        data-end={section.start + section.length}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY })
        }}
        className="absolute top-1.5 bottom-1.5 flex cursor-grab touch-none items-center overflow-hidden rounded-xs border border-line-strong bg-raised px-3 text-body whitespace-nowrap outline-none focus-visible:border-text-2 data-[playing=true]:border-accent"
        style={{ left: percent(section.start, visible), width: `calc(${percent(section.length, visible)} - 4px)` }}
      >
        <span className="truncate">{name}</span>
        <span aria-hidden="true" className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize" />
      </div>
      {menu && (
        <ContextMenu
          label={`${name} section menu`}
          position={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Duplicate after the song', onSelect: () => update(addSection(section.sceneId)) },
            { label: 'Remove from the song', onSelect: () => update(removeSection(section.id)) },
          ]}
        />
      )}
    </>
  )
}
