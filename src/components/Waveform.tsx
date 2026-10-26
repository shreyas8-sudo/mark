import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { peakMax } from '../lib/peaks'

type Props = {
  peaks: Float32Array
  /** Colour for each column, given its 0–1 position across the canvas. */
  colorAt?: (x: number) => string
  className?: string
}

/** Mirrored bar waveform on a canvas, crisp at any devicePixelRatio. */
export function Waveform({ peaks, colorAt, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current!
    const r = el.getBoundingClientRect()
    setSize({ w: r.width, h: r.height })
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !size.w) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size.w, size.h)

    const style = getComputedStyle(canvas)
    const fallback = style.color
    const bar = 2
    const gap = 1
    const columns = Math.floor(size.w / (bar + gap))
    const max = peakMax(peaks)
    const mid = size.h / 2
    for (let c = 0; c < columns; c++) {
      const from = Math.floor((c / columns) * peaks.length)
      const to = Math.max(from + 1, Math.floor(((c + 1) / columns) * peaks.length))
      let v = 0
      for (let i = from; i < to; i++) if (peaks[i] > v) v = peaks[i]
      const h = Math.max(1.5, (v / max) * (size.h - 2))
      ctx.fillStyle = colorAt ? colorAt((c + 0.5) / columns) : fallback
      ctx.fillRect(c * (bar + gap), mid - h / 2, bar, h)
    }
  }, [peaks, size, colorAt])

  return <canvas ref={ref} className={className} aria-hidden />
}
