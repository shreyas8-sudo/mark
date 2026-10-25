// Beat → count math. Everything is in seconds of *video* time at 1×;
// playbackRate never enters these formulas.

export const COUNTS_PER_BAR = 8

// Seeking to an exact beat time can read back a hair early (float + decoder
// frame snapping), which would floor to the previous count. Nudge forward.
const EPSILON = 0.005

export type Grid = { bpm: number; offset: number }

export type Position = {
  beatIndex: number // 0-based beats since offset, clamped at 0
  count: number // 1–8
  bar: number // 1-based
  beatProgress: number // 0–1 through the current beat
}

export const beatLen = ({ bpm }: Grid) => 60 / bpm
export const barLen = (g: Grid) => beatLen(g) * COUNTS_PER_BAR

export function position(t: number, g: Grid): Position {
  const len = beatLen(g)
  const raw = (t - g.offset + EPSILON) / len
  const beatIndex = Math.max(0, Math.floor(raw))
  return {
    beatIndex,
    count: (beatIndex % COUNTS_PER_BAR) + 1,
    bar: Math.floor(beatIndex / COUNTS_PER_BAR) + 1,
    beatProgress: raw < 0 ? 0 : raw - Math.floor(raw),
  }
}

export const beatTime = (beatIndex: number, g: Grid) =>
  g.offset + beatIndex * beatLen(g)

export const barStart = (bar: number, g: Grid) =>
  g.offset + (bar - 1) * barLen(g)

export const barEnd = (bar: number, g: Grid) => barStart(bar + 1, g)

export function barCount(duration: number, g: Grid) {
  return Math.max(1, Math.floor((duration - g.offset) / barLen(g)))
}

/** Time of the beat `dir` steps away from the one containing `t`. */
export function stepBeat(t: number, dir: 1 | -1, g: Grid, duration: number) {
  const { beatIndex } = position(t, g)
  const next = Math.max(0, beatIndex + dir)
  return Math.min(beatTime(next, g), duration)
}

/** Where to seek when looping `bar`, or null if `t` is still inside it. */
export function loopTarget(t: number, bar: number, g: Grid) {
  return t >= barEnd(bar, g) || t < barStart(bar, g) - EPSILON
    ? barStart(bar, g)
    : null
}
