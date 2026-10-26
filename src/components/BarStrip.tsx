import { useEffect, useMemo, useRef, type PointerEvent } from 'react'
import { barEnd, barStart, type Grid } from '../lib/beat'
import { peakMax, slicePeaks } from '../lib/peaks'
import { Waveform } from './Waveform'
import './BarStrip.css'

const LONG_PRESS_MS = 450

type Common = {
  peaks: Float32Array | null
  duration: number
  grid: Grid
  bars: number
  learned?: number[]
  /** 'current': number only under the current chunk (phone). 'all': laptop. */
  labels?: 'current' | 'all'
  /** Fixed chunk width (phone, scrolls); omit to share the width (laptop). */
  chunkWidth?: number
  className?: string
}

type PlayProps = Common & {
  current: number
  t: number // playhead, in video seconds
  looping?: number | null
  onPick: (bar: number) => void
  onLoop?: (bar: number) => void
  range?: undefined
}

type RangeProps = Common & {
  /** Rehearse · Setup: a draggable selection instead of a playhead. */
  range: { start: number; end: number }
  onRange: (start: number, end: number) => void
  current?: undefined
}

/**
 * The song's waveform split into one chunk per bar, with gaps at every
 * `offset + n × barLen`. Learned bars are solid, the current bar glows
 * with a moving playhead, the rest are faint.
 */
export function BarStrip(props: PlayProps | RangeProps) {
  const { peaks, duration, grid, bars, learned = [], labels = 'current', chunkWidth, className = '' } = props
  const rowRef = useRef<HTMLDivElement>(null)
  const max = useMemo(() => (peaks ? peakMax(peaks) : 1), [peaks])
  const chunks = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const bar = i + 1
        return { bar, peaks: peaks ? slicePeaks(peaks, duration, barStart(bar, grid), barEnd(bar, grid)) : null }
      }),
    [peaks, duration, grid, bars],
  )

  // Keep the current bar centred on a scrolling (phone) strip.
  const focus = props.range ? props.range.end : props.current
  useEffect(() => {
    const row = rowRef.current
    const chunk = row?.querySelector<HTMLElement>(`[data-bar="${focus}"]`)
    if (!chunkWidth || !row || !chunk) return
    const left = chunk.offsetLeft + chunk.offsetWidth / 2 - row.clientWidth / 2
    // Glide to the next bar; jump when skipping further (a tap far away).
    const near = Math.abs(left - row.scrollLeft) < chunkWidth * 2
    row.scrollTo({ left, behavior: near ? 'smooth' : 'auto' })
  }, [focus, chunkWidth])

  // ---- Range selection (Rehearse setup): drag either end ----
  // 'either': pressed on a one-bar range; the first move decides which end.
  const dragEnd = useRef<'start' | 'end' | 'either' | null>(null)
  const barAt = (clientX: number) => {
    const el = [...(rowRef.current?.querySelectorAll<HTMLElement>('[data-bar]') ?? [])].find((c) => {
      const r = c.getBoundingClientRect()
      return clientX >= r.left - 2 && clientX <= r.right + 2
    })
    if (el) return Number(el.dataset.bar)
    const first = rowRef.current!.querySelector<HTMLElement>('[data-bar]')!.getBoundingClientRect()
    return clientX < first.left ? 1 : bars
  }
  const onRangeDown = (e: PointerEvent) => {
    if (!props.range) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { start, end } = props.range
    const bar = barAt(e.clientX)
    dragEnd.current =
      start === end && bar === start ? 'either'
      : bar <= start ? 'start'
      : bar >= end ? 'end'
      : bar - start < end - bar ? 'start' : 'end'
    if (dragEnd.current !== 'either') moveRange(bar)
  }
  const onRangeMove = (e: PointerEvent) => {
    if (!dragEnd.current || !props.range) return
    const bar = barAt(e.clientX)
    if (dragEnd.current === 'either') {
      if (bar === props.range.start) return
      dragEnd.current = bar > props.range.start ? 'end' : 'start'
    }
    moveRange(bar)
  }
  const onRangeUp = () => {
    dragEnd.current = null
  }
  const moveRange = (bar: number) => {
    if (!props.range) return
    const { start, end } = props.range
    if (dragEnd.current === 'start') props.onRange(Math.min(bar, end), end)
    else props.onRange(start, Math.max(bar, start))
  }

  // ---- Play mode: tap = jump, long-press / right-click = loop ----
  const pressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const startPress = (bar: number) => {
    longPressed.current = false
    if (props.range || !props.onLoop) return
    const onLoop = props.onLoop
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      onLoop(bar)
    }, LONG_PRESS_MS)
  }
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }

  return (
    <div
      ref={rowRef}
      className={`bar-strip ${className}`}
      data-labels={labels}
      data-scroll={chunkWidth ? true : undefined}
      data-range={props.range ? true : undefined}
      role={props.range ? 'group' : 'toolbar'}
      aria-label={props.range ? `Bars ${props.range.start} to ${props.range.end}` : 'Bars'}
      onPointerDown={props.range ? onRangeDown : undefined}
      onPointerMove={props.range ? onRangeMove : undefined}
      onPointerUp={props.range ? onRangeUp : undefined}
      onPointerCancel={props.range ? onRangeUp : undefined}
    >
      {chunks.map(({ bar, peaks: p }) => {
        const state = props.range
          ? bar >= props.range.start && bar <= props.range.end ? 'selected' : 'idle'
          : bar === props.current ? 'current'
          : learned.includes(bar) ? 'learned'
          : 'idle'
        const progress =
          !props.range && bar === props.current
            ? Math.min(1, Math.max(0, (props.t - barStart(bar, grid)) / (barEnd(bar, grid) - barStart(bar, grid))))
            : null
        const inner = (
          <>
            <span className="bar-strip__wave">
              {p && <Waveform peaks={p} max={max} tone={state} className="bar-strip__canvas" />}
              {progress != null && <span className="bar-strip__playhead" style={{ left: `${progress * 100}%` }} />}
            </span>
            <span className="bar-strip__label mk-label-mono">{bar}</span>
          </>
        )
        const style = chunkWidth ? { width: chunkWidth } : undefined
        return props.range ? (
          <span key={bar} data-bar={bar} data-state={state} className="bar-strip__chunk" style={style}>
            {inner}
          </span>
        ) : (
          <button
            key={bar}
            type="button"
            data-bar={bar}
            data-state={state}
            data-looping={props.looping === bar || undefined}
            className="bar-strip__chunk"
            style={style}
            aria-label={`Bar ${bar}${state === 'learned' ? ', learned' : ''}`}
            aria-current={state === 'current'}
            onPointerDown={() => startPress(bar)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onClick={() => {
              if (!longPressed.current) props.onPick(bar)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              cancelPress()
              props.onLoop?.(bar)
            }}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}
