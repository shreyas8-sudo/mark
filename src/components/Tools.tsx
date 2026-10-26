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
 * The one row of glass tool buttons over the video. Phone (portrait and
 * landscape) and laptop render the same buttons in the same order; only
 * where the row sits and the button size change.
 */
export function ToolRow({ tools, size = 40 }: { tools: Tool[]; size?: number }) {
  return (
    <nav className="tool-row" aria-label="Tools">
      {tools.map((t) => (
        <GlassButton
          key={t.id}
          icon={t.icon}
          glyph={t.glyph}
          label={t.label}
          title={t.label}
          size={size}
          on={t.on}
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
 * A popover anchored directly under the button that opened it, centred on
 * it and nudged inside the screen. Fixed to the viewport, above everything
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
      const left = Math.min(Math.max(MARGIN, a.left + a.width / 2 - w / 2), window.innerWidth - w - MARGIN)
      setPos({ left, top: a.bottom + GAP })
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
