import { useLayoutEffect, useRef, type MouseEvent } from 'react'
import { COUNTS_PER_BAR, type Position } from '../lib/beat'
import './BarCircles.css'

type Props = {
  barStart: number
  barEnd: number
  /** Where the run is, or null before the bars play (idle / count-in). */
  pos: Position | null
  /** Whole run finished: every bar shows full. */
  done?: boolean
  /** Jump to `count` (1–8) of `bar`. */
  onSeek?: (bar: number, count: number) => void
}

// One 45° arc per count, starting at 12 o'clock, with a small gap.
const R = 44
const GAP = 7 // degrees
const point = (deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return `${50 + R * Math.cos(a)} ${50 + R * Math.sin(a)}`
}
const ARCS = Array.from({ length: COUNTS_PER_BAR }, (_, i) => {
  const step = 360 / COUNTS_PER_BAR
  const a0 = i * step + GAP / 2
  const a1 = (i + 1) * step - GAP / 2
  return `M ${point(a0)} A ${R} ${R} 0 0 1 ${point(a1)}`
})

/**
 * Rehearse: the run's bars as a column of circles. Each outline is 8 arcs
 * that fill one per count; the current bar is twice the size, so the
 * count reads from across the room.
 */
export function BarCircles({ barStart: first, barEnd: last, pos, done, onSeek }: Props) {
  const bars = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const current = pos ? Math.min(Math.max(pos.bar, first), last) : first
  const listRef = useRef<HTMLDivElement>(null)

  // Keep the current bar centred in the column when the run is long.
  useLayoutEffect(() => {
    const list = listRef.current
    const el = list?.querySelector<HTMLElement>('[data-current]')
    if (!list || !el || list.scrollHeight <= list.clientHeight) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({ top: el.offsetTop - (list.clientHeight - el.offsetHeight) / 2, behavior: reduce ? 'auto' : 'smooth' })
  }, [current])

  const filled = (bar: number) => {
    if (done || (pos && bar < pos.bar)) return COUNTS_PER_BAR
    return pos && bar === pos.bar ? pos.count : 0
  }

  // Ring = jump to that count; centre (or keyboard) = jump to the bar start.
  const tap = (bar: number) => (e: MouseEvent<HTMLButtonElement>) => {
    if (!onSeek) return
    if (e.detail === 0) return onSeek(bar, 1)
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - (r.left + r.width / 2)
    const y = e.clientY - (r.top + r.height / 2)
    if (Math.hypot(x, y) < (r.width / 2) * 0.62) return onSeek(bar, 1)
    const deg = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360
    onSeek(bar, Math.floor(deg / (360 / COUNTS_PER_BAR)) + 1)
  }

  return (
    <div ref={listRef} className="bar-circles" role="group" aria-label="Bars">
      <div className="bar-circles__list">
        {bars.map((bar) => {
          const n = filled(bar)
          const isCurrent = bar === current
          return (
            <button
              key={bar}
              type="button"
              className="bar-circle"
              data-current={isCurrent || undefined}
              disabled={!onSeek}
              aria-label={`Bar ${bar}${isCurrent && pos ? `, count ${pos.count}` : ''}`}
              onClick={tap(bar)}
            >
              <svg viewBox="0 0 100 100" aria-hidden>
                {ARCS.map((d, i) => (
                  <g key={i}>
                    <path className="bar-circle__track" d={d} />
                    <path className="bar-circle__fill" d={d} pathLength={1} data-on={i < n || undefined} />
                  </g>
                ))}
              </svg>
              <span className="bar-circle__num">{bar}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
