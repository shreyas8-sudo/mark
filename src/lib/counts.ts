// Counts set by hand: the dancer marks where count 1 and count 8 of the
// same bar land. Everything else (tempo, first beat, bars) follows.
import { COUNTS_PER_BAR, type Grid } from './beat'

// Tempos a dance count could plausibly have; outside this the marks are
// almost certainly on the wrong beats.
export const MIN_BPM = 40
export const MAX_BPM = 240

/** beatLen = (t8 − t1) / 7, bpm = 60 / beatLen, offset = t1. */
export function gridFromMarks(t1: number, t8: number): Grid {
  const beatLen = (t8 - t1) / (COUNTS_PER_BAR - 1)
  return { bpm: 60 / beatLen, offset: t1 }
}

/** Why the marks can't be used yet, or null when they can. */
export function marksProblem(t1: number | null, t8: number | null): string | null {
  if (t1 == null) return 'Mark count 1'
  if (t8 == null) return 'Now mark count 8'
  if (t8 <= t1) return 'Count 8 needs to come after count 1'
  const { bpm } = gridFromMarks(t1, t8)
  if (bpm > MAX_BPM) return 'Those are too close together for 1 and 8'
  if (bpm < MIN_BPM) return 'Those are too far apart for 1 and 8'
  return null
}
