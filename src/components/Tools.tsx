import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { GlassButton } from './controls'
import type { IconName } from './Icon'
import './Tools.css'

export type Tool = {
  id: string
  label: string
  icon?: IconName
  /** Text in place of an icon, set in Geist Mono (e.g. the count-in "5678", "0.5×"). */
  glyph?: ReactNode
  on?: boolean
  open?: boolean
  coach?: string
  onClick: (button: HTMLButtonElement) => void
}

/**
 * The tool buttons: glass over the video, `solid` beside it. Phone and
 * laptop render the same buttons in the same order, as a `vertical` column
 * at the side of the video.
 */
export function ToolRow({ tools, size = 40, solid, vertical }: { tools: Tool[]; size?: number; solid?: boolean; vertical?: boolean }) {
  return (
    <nav className={`tool-row${vertical ? ' tool-row--column' : ''}`} aria-label="Tools">
      {tools.map((t) => (
        <GlassButton
          key={t.id}
          icon={t.icon}
          glyph={t.glyph}
          label={t.label}
          title={t.label}
          size={size}
          solid={solid}
          className={`tool-btn${t.on ? ' is-on' : ''}${t.open ? ' is-open' : ''}`}
          aria-pressed={t.on}
          aria-expanded={t.open}
          data-coach={t.coach}
          onClick={(e) => t.onClick(e.currentTarget)}
        />
      ))}
    </nav>
  )
}

const GAP = 8
const MARGIN = 12

/**
 * A popover anchored directly under the button that opened it (above it
 * when there's no room below), centred on it and nudged inside the screen. Fixed to the viewport, above everything
 * else on the screen; a tap outside closes it.
 */
export function AnchoredPopover({
  anchor,
  label,
  className = '',
  onClose,
  children,
}: {
  anchor: HTMLElement
  label: string
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.getBoundingClientRect()
      const w = ref.current?.offsetWidth ?? 0
      const h = ref.current?.offsetHeight ?? 0
      const left = Math.min(Math.max(MARGIN, a.left + a.width / 2 - w / 2), window.innerWidth - w - MARGIN)
      const below = a.bottom + GAP + h <= window.innerHeight - MARGIN
      setPos({ left, top: below ? a.bottom + GAP : Math.max(MARGIN, a.top - GAP - h) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor])

  const style: CSSProperties = pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }
  return (
    <>
      <button type="button" className="anchored-dismiss" aria-label="Close" onClick={onClose} />
      <div ref={ref} className={`popover anchored-popover ${className}`} role="dialog" aria-label={label} style={style}>
        {children}
      </div>
    </>
  )
}
