import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  /** Strudel code shown next to the label, when the item maps to one. */
  code?: string
  onSelect?: () => void
  disabled?: boolean
  /** Why the item is disabled, shown as a tooltip. */
  hint?: string
  /** Renders a small swatch instead of text, for color choices. */
  swatch?: string
}

export interface MenuPosition {
  x: number
  y: number
}

/** A menu at a screen position, keyboard operable (arrows, Enter, Escape). Closes on outside click. */
export function ContextMenu(props: { position: MenuPosition; items: MenuItem[]; label: string; onClose: () => void }) {
  const { position, items, label, onClose } = props
  const ref = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState(position)
  const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0)

  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return
    const { width, height } = menu.getBoundingClientRect()
    setPlace({
      x: Math.min(position.x, window.innerWidth - width - 8),
      y: Math.min(position.y, window.innerHeight - height - 8),
    })
    menu.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
  }, [position])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const onKeyDown = (event: KeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[next]?.focus()
    }
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ left: place.x, top: place.y }}
      className="fixed z-50 flex min-w-48 flex-col rounded-input border border-line-strong bg-raised p-1 text-body"
    >
      {items.map((item, index) => (
        <button
          key={`${item.label}-${String(index)}`}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          title={item.hint}
          onClick={() => {
            onClose()
            item.onSelect?.()
          }}
          className="flex items-center justify-between gap-6 rounded-xs px-3 py-1.5 text-left text-text hover:bg-active focus-visible:bg-active focus-visible:outline-none disabled:text-text-3 disabled:hover:bg-transparent"
        >
          <span className="flex items-center gap-2">
            {item.swatch && <span className={`size-3 rounded-xs ${item.swatch}`} />}
            {item.label}
          </span>
          {item.code && <span className="font-mono text-knob-value text-text-3">{item.code}</span>}
        </button>
      ))}
      {enabled.length === 0 && <span className="px-3 py-1.5 text-text-3">No action available</span>}
    </div>,
    document.body,
  )
}
