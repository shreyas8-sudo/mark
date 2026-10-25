// Rehearse runner: idle → countIn → playing(loop, play) → next play | next
// loop | done. Pure, so the whole run can be tested without a video.
import type { Loop } from '../types'

export type RunState =
  | { phase: 'idle' }
  // seq changes whenever a new play starts (not on pause/resume), so the
  // screen knows when to cue the video back to the top of the range.
  | { phase: 'countIn' | 'playing'; loop: number; play: number; paused: boolean; seq: number }
  | { phase: 'done' }

export type RunEvent =
  | { type: 'start' }
  | { type: 'countInDone' }
  | { type: 'reachedEnd' } // the bar range finished playing once
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; loop: number }
  | { type: 'restart' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end' }

export type RunConfig = { loops: Loop[]; countIn: boolean }

export const IDLE: RunState = { phase: 'idle' }

// Monotonic id source for `seq`; only uniqueness matters, so a reducer call
// that React discards (StrictMode) skipping a number is harmless.
let seq = 0

/** Entering a loop always starts at its first play, with the count-in if on. */
function enter(loop: number, cfg: RunConfig): RunState {
  if (loop >= cfg.loops.length) return { phase: 'done' }
  return { phase: cfg.countIn ? 'countIn' : 'playing', loop, play: 0, paused: false, seq: ++seq }
}

export function runReducer(cfg: RunConfig) {
  return (s: RunState, e: RunEvent): RunState => {
    if (e.type === 'end') return IDLE
    if (e.type === 'start') return cfg.loops.length ? enter(0, cfg) : s
    if (s.phase === 'done') return e.type === 'restart' ? enter(0, cfg) : s
    if (s.phase === 'idle') return s

    switch (e.type) {
      case 'countInDone':
        return s.phase === 'countIn' ? { ...s, phase: 'playing' } : s
      case 'reachedEnd': {
        if (s.phase !== 'playing') return s
        // More plays of this loop go straight on; the count-in is per loop.
        if (s.play + 1 < cfg.loops[s.loop].plays) return { ...s, play: s.play + 1, seq: ++seq }
        return enter(s.loop + 1, cfg)
      }
      case 'next':
        return enter(s.loop + 1, cfg)
      case 'prev':
        return enter(Math.max(0, s.loop - 1), cfg)
      case 'goto':
        return enter(Math.min(Math.max(0, e.loop), cfg.loops.length - 1), cfg)
      case 'restart':
        return enter(s.loop, cfg)
      case 'pause':
        return { ...s, paused: true }
      case 'resume':
        // The screen reschedules a resumed count-in from 5, never mid-count.
        return { ...s, paused: false }
    }
  }
}

/** Rough run length in seconds, for the "~1 MIN" summary. */
export function runSeconds(cfg: RunConfig, bars: number, barLen: number) {
  const beat = barLen / 8
  return cfg.loops.reduce(
    (sum, l) => sum + (l.plays * bars * barLen + (cfg.countIn ? 4 * beat : 0)) / l.speed,
    0,
  )
}
