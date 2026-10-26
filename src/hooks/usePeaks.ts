import { useEffect, useRef, useState } from 'react'
import { DEMO_PEAKS } from '../data/demo'
import { decodeAudio } from '../lib/analyze'
import { computePeaks } from '../lib/peaks'
import type { Dance } from '../types'

const demoPeaks = new Map<string, Promise<Float32Array>>()

/**
 * The dance's waveform peaks: cached on the dance, shipped as JSON for the
 * demo, or (for clips saved before v2) computed once and handed back via
 * `onComputed` so the caller can store them.
 */
export function usePeaks(dance: Dance, onComputed?: (peaks: Float32Array) => void) {
  const [loaded, setLoaded] = useState<{ id: string; peaks: Float32Array } | null>(null)
  const cached = dance.peaks ?? (loaded?.id === dance.id ? loaded.peaks : null)
  const onComputedRef = useRef(onComputed)
  useEffect(() => {
    onComputedRef.current = onComputed
  })

  useEffect(() => {
    if (cached) return
    let live = true
    const shipped = DEMO_PEAKS[dance.id]
    if (shipped && !demoPeaks.has(dance.id)) {
      demoPeaks.set(
        dance.id,
        fetch(shipped)
          .then((r) => r.json() as Promise<number[]>)
          .then((a) => Float32Array.from(a)),
      )
    }
    const job = shipped
      ? demoPeaks.get(dance.id)!
      : decodeAudio(dance.video).then((audio) => {
          const p = computePeaks(audio.getChannelData(0))
          onComputedRef.current?.(p)
          return p
        })
    job.then((peaks) => live && setLoaded({ id: dance.id, peaks })).catch(console.error)
    return () => {
      live = false
    }
  }, [cached, dance.id, dance.video])

  return cached
}
