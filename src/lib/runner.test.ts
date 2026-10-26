import { describe, expect, it } from 'vitest'
import type { Loop } from '../types'
import { IDLE, runReducer, type RunConfig, type RunState } from './runner'

const DEFAULT_LOOPS: Loop[] = [
  { speed: 0.5, plays: 1 },
  { speed: 0.75, plays: 1 },
  { speed: 1, plays: 1 },
]

/** Run hands-free to the end and list the speed of every play. */
function playThrough(cfg: RunConfig) {
  const step = runReducer(cfg)
  let s: RunState = step(IDLE, { type: 'start' })
  const played: number[] = []
  const countIns: number[] = []
  for (let guard = 0; guard < 100 && s.phase !== 'done'; guard++) {
    if (s.phase === 'countIn') {
      countIns.push(s.loop)
      s = step(s, { type: 'countInDone' })
    } else if (s.phase === 'playing') {
      played.push(cfg.loops[s.loop].speed)
      s = step(s, { type: 'reachedEnd' })
    }
  }
  return { played, countIns, end: s }
}

describe('rehearse runner', () => {
  // Spec: "Start rehearsing, defaults → 5-6-7-8 → bars 1–4 at 0.5× → 0.75× → 1× → done"
  it('runs the default loops in order with a count-in before each', () => {
    const r = playThrough({ loops: DEFAULT_LOOPS, countIn: true })
    expect(r.played).toEqual([0.5, 0.75, 1])
    expect(r.countIns).toEqual([0, 1, 2])
    expect(r.end.phase).toBe('done')
  })

  // Spec: "Delete loop 02, add 1.25× × 2 → runner plays 0.5×, 1×, 1.25×, 1.25×"
  it('plays an edited run, repeating a loop for its plays', () => {
    const loops = [DEFAULT_LOOPS[0], DEFAULT_LOOPS[2], { speed: 1.25, plays: 2 }]
    const r = playThrough({ loops, countIn: true })
    expect(r.played).toEqual([0.5, 1, 1.25, 1.25])
    expect(r.countIns).toEqual([0, 1, 2]) // not before the repeat play
  })

  it('skips the count-in when it is off', () => {
    const cfg = { loops: DEFAULT_LOOPS, countIn: false }
    expect(runReducer(cfg)(IDLE, { type: 'start' })).toMatchObject({ phase: 'playing', loop: 0 })
    expect(playThrough(cfg).countIns).toEqual([])
  })

  it('jumps loops mid-run and restarts with a fresh count-in', () => {
    const step = runReducer({ loops: DEFAULT_LOOPS, countIn: true })
    let s = step(step(IDLE, { type: 'start' }), { type: 'countInDone' })
    s = step(s, { type: 'next' })
    expect(s).toMatchObject({ phase: 'countIn', loop: 1, play: 0 })
    s = step(step(s, { type: 'countInDone' }), { type: 'restart' })
    expect(s).toMatchObject({ phase: 'countIn', loop: 1 })
    s = step(s, { type: 'prev' })
    expect(s).toMatchObject({ loop: 0 })
    expect(step(s, { type: 'prev' })).toMatchObject({ loop: 0 })
    s = step(s, { type: 'next' })
    s = step(s, { type: 'next' })
    expect(step(s, { type: 'next' }).phase).toBe('done')
  })

  it('pauses and resumes without losing its place', () => {
    const step = runReducer({ loops: DEFAULT_LOOPS, countIn: true })
    let s = step(step(step(IDLE, { type: 'start' }), { type: 'countInDone' }), { type: 'pause' })
    expect(s).toMatchObject({ phase: 'playing', loop: 0, paused: true })
    expect(step(s, { type: 'reachedEnd' })).toMatchObject({ loop: 1 })
    s = step(s, { type: 'resume' })
    expect(s).toMatchObject({ phase: 'playing', paused: false })
  })

  it('ends back at setup from anywhere', () => {
    const step = runReducer({ loops: DEFAULT_LOOPS, countIn: true })
    expect(step(step(IDLE, { type: 'start' }), { type: 'end' })).toEqual(IDLE)
  })
})
