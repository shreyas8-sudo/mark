// Guided Learn: which bars are learned, and how Rehearse's range follows them.
import type { Dance } from '../types'

export const SLOW_SPEED = 0.5

export const markLearned = (learned: number[], bar: number) =>
  learned.includes(bar) ? learned : [...learned, bar].sort((a, b) => a - b)

export const unmarkLearned = (learned: number[], bar: number) => learned.filter((b) => b !== bar)

/** The last learned bar, or 1 when nothing is learned yet. */
export const lastLearned = (learned: number[]) => (learned.length ? Math.max(...learned) : 1)

/**
 * Rehearse defaults to bar 1 → last learned bar. Keep following the
 * learned bars only while the range is still that default; once the
 * dancer drags it somewhere else, leave it alone.
 */
export function followLearned(run: Dance['run'], before: number[], after: number[]): Dance['run'] {
  const followed = run.barStart === 1 && run.barEnd === lastLearned(before)
  return followed ? { ...run, barEnd: lastLearned(after) } : run
}
