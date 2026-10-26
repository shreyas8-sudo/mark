import { describe, expect, it } from 'vitest'
import { computePeaks, slicePeaks, windowPeaks } from './peaks'

describe('peaks', () => {
  it('takes the max absolute sample per bucket', () => {
    const s = new Float32Array([0.1, -0.5, 0.2, 0, 0.9, -0.3, 0, -1])
    expect([...computePeaks(s, 4)]).toEqual([0.5, 0.2, 0.9, 1].map(Math.fround))
  })

  it('never makes more buckets than samples', () => {
    expect(computePeaks(new Float32Array([0.3, 0.4]), 4000).length).toBe(2)
  })

  it('finds a hit in the right place in a window', () => {
    const rate = 100
    const s = new Float32Array(10 * rate) // 10 s of silence
    s[5 * rate] = 1 // a hit at 5.00 s
    const w = windowPeaks(s, rate, 4, 6, 20) // 2 s at 0.1 s per bucket
    expect(w.indexOf(1)).toBe(10)
  })

  it('slices whole-song peaks by time', () => {
    const p = new Float32Array(100).map((_, i) => i)
    expect([...slicePeaks(p, 10, 2, 3)]).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29])
  })
})
