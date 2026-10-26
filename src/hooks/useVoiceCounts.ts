import { useEffect, useRef, type RefObject } from 'react'
import type { Grid } from '../lib/beat'
import { beatsBetween, mediaToCtx, scheduleWindow } from '../lib/beatClock'
import { audioContext } from '../lib/countIn'
import { loadVoices, playVoices, type Scheduled, type VoiceName } from '../lib/voice'

const LOOKAHEAD = 0.6 // real seconds of counts queued ahead of the playhead
const TICK_MS = 100

type Options = {
  enabled: boolean
  grid: Grid
  volume: number
  /** Video time the playhead jumps back from (loop end / run range end). */
  stopAt?: number | null
}

/**
 * Speaks "one"…"eight" on the beats of a playing video. Each count is
 * queued on the AudioContext clock at its exact time for the current
 * playbackRate; any seek, pause or speed change drops the queue and
 * re-plans from the new playhead, so loops and jumps stay on the beat.
 */
export function useVoiceCounts(videoRef: RefObject<HTMLVideoElement | null>, { enabled, grid, volume, stopAt }: Options) {
  const stopAtRef = useRef(stopAt)
  useEffect(() => {
    stopAtRef.current = stopAt
  })

  const { bpm, offset } = grid
  useEffect(() => {
    const video = videoRef.current
    if (!enabled || !video) return
    const g = { bpm, offset }
    let clips: Awaited<ReturnType<typeof loadVoices>> | null = null
    const queued = new Map<number, Scheduled>() // by beat index

    const clear = () => {
      queued.forEach((s) => s.cancel())
      queued.clear()
    }
    const tick = () => {
      if (!clips || video.paused || video.seeking || video.readyState < 3) return
      const ctx = audioContext()
      if (ctx.state !== 'running') return void ctx.resume()
      const now = video.currentTime
      const rate = video.playbackRate
      const { from, to } = scheduleWindow(now, rate, LOOKAHEAD, stopAtRef.current ?? Infinity)
      for (const b of beatsBetween(g, from, to)) {
        if (queued.has(b.beatIndex)) continue
        const at = mediaToCtx(b.mediaTime, now, ctx.currentTime, rate)
        queued.set(b.beatIndex, playVoices(clips, [{ name: String(b.count) as VoiceName, at }], volume))
      }
      // Forget counts that have played, so a loop's next lap can queue them again.
      for (const [i] of queued) if (offset + i * (60 / bpm) < now - 0.5) queued.delete(i)
    }

    void loadVoices().then((c) => {
      clips = c
      tick()
    })
    const id = window.setInterval(tick, TICK_MS)
    // Seek, pause and speed change invalidate what's queued; playing/seeked
    // only top it up (queued beats are skipped), so a loop wrap — which
    // fires both — never cancels and re-queues the same "one".
    const replan = ['seeking', 'pause', 'ratechange']
    const resume = ['playing', 'seeked']
    replan.forEach((e) => video.addEventListener(e, clear))
    resume.forEach((e) => video.addEventListener(e, tick))
    return () => {
      clearInterval(id)
      clear()
      replan.forEach((e) => video.removeEventListener(e, clear))
      resume.forEach((e) => video.removeEventListener(e, tick))
    }
  }, [videoRef, enabled, bpm, offset, volume])
}
