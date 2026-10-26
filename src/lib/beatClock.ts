// Mapping between video time and the AudioContext clock, so spoken counts
// can be scheduled sample-accurately instead of fired from timers.
import { beatTime, COUNTS_PER_BAR, type Grid } from './beat'

export type BeatAt = { beatIndex: number; count: number; mediaTime: number }

/** Every beat whose time falls in [from, to) of video time. */
export function beatsBetween(g: Grid, from: number, to: number): BeatAt[] {
  const len = 60 / g.bpm
  const first = Math.max(0, Math.ceil((from - g.offset) / len - 1e-6))
  const out: BeatAt[] = []
  for (let i = first; ; i++) {
    const mediaTime = beatTime(i, g)
    if (mediaTime >= to) break
    out.push({ beatIndex: i, count: (i % COUNTS_PER_BAR) + 1, mediaTime })
  }
  return out
}

/**
 * When a video moment will be heard on the audio clock: the video is at
 * `mediaNow` (playing at `rate`) when the context reads `ctxNow`.
 */
export function mediaToCtx(mediaTime: number, mediaNow: number, ctxNow: number, rate: number) {
  return ctxNow + (mediaTime - mediaNow) / rate
}
