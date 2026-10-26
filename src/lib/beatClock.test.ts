import { describe, expect, it } from 'vitest'
import { beatsBetween, mediaToCtx, scheduleWindow } from './beatClock'

const g = { bpm: 120, offset: 1 } // 0.5 s beats starting at 1 s

describe('beat clock', () => {
  it('lists the beats in a window with their counts', () => {
    const beats = beatsBetween(g, 1, 3)
    expect(beats.map((b) => b.mediaTime)).toEqual([1, 1.5, 2, 2.5])
    expect(beats.map((b) => b.count)).toEqual([1, 2, 3, 4])
  })

  it('wraps counts every 8 and ignores time before the first beat', () => {
    expect(beatsBetween(g, 0, 1.2).map((b) => b.count)).toEqual([1])
    expect(beatsBetween(g, 4.9, 5.6).map((b) => b.count)).toEqual([1, 2])
  })

  it('includes a beat exactly at the window start', () => {
    expect(beatsBetween(g, 2, 2.1)[0]?.mediaTime).toBe(2)
  })

  // Spec: "Voice mode at 0.5× — spoken counts stay on the beat"
  it('maps video time to the audio clock at any speed', () => {
    expect(mediaToCtx(3, 2, 10, 1)).toBe(11)
    expect(mediaToCtx(3, 2, 10, 0.5)).toBe(12) // one video-second takes two real seconds
    expect(mediaToCtx(3, 2, 10, 1.25)).toBeCloseTo(10.8)
  })
})

describe('schedule window', () => {
  it('looks ahead in real seconds, so slower playback covers less video time', () => {
    expect(scheduleWindow(10, 1, 0.6).to).toBeCloseTo(10.6)
    expect(scheduleWindow(10, 0.5, 0.6).to).toBeCloseTo(10.3)
  })

  // Spec: "Voice mode at 0.5× — spoken counts stay on the beat across a 4-bar loop"
  it('never schedules the beat at a loop end (the wrap plays it instead)', () => {
    const loopEnd = 3 // bar ends exactly on a beat
    const w = scheduleWindow(2.8, 0.5, 0.6, loopEnd)
    const beats = beatsBetween(g, w.from, w.to).map((b) => b.mediaTime)
    expect(beats).not.toContain(3)
    // after the wrap, the bar's first beat is in the window again
    const after = scheduleWindow(1, 0.5, 0.6, loopEnd)
    expect(beatsBetween(g, after.from, after.to)[0]).toMatchObject({ mediaTime: 1, count: 1 })
  })
})
