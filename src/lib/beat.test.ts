import { describe, expect, it } from 'vitest'
import {
  barCount,
  barLen,
  barStart,
  beatLen,
  loopTarget,
  position,
  stepBeat,
} from './beat'

const g = { bpm: 96, offset: 0.42 }
const beat = 60 / 96

describe('beat grid', () => {
  it('derives beat and bar length from bpm', () => {
    expect(beatLen(g)).toBeCloseTo(0.625)
    expect(barLen(g)).toBeCloseTo(5)
  })

  it('maps time to count and bar', () => {
    expect(position(g.offset, g)).toMatchObject({ count: 1, bar: 1 })
    expect(position(g.offset + 2.5 * beat, g)).toMatchObject({ count: 3, bar: 1 })
    expect(position(g.offset + 8 * beat, g)).toMatchObject({ count: 1, bar: 2 })
    expect(position(g.offset + 15.9 * beat, g)).toMatchObject({ count: 8, bar: 2 })
  })

  it('treats time before the first beat as bar 1 count 1', () => {
    expect(position(0, g)).toMatchObject({ beatIndex: 0, count: 1, bar: 1 })
  })

  it('survives a seek that lands a hair before the beat', () => {
    expect(position(g.offset + 3 * beat - 0.001, g).count).toBe(4)
  })

  // Spec: "96 BPM clip, tap bar 3 → offset + 2 × barLen, badge shows 1"
  it('jumps to the start of a bar', () => {
    const t = barStart(3, g)
    expect(t).toBeCloseTo(g.offset + 2 * barLen(g))
    expect(position(t, g)).toMatchObject({ count: 1, bar: 3 })
  })

  // Spec: "Paused on count 3, tap › → count 4, exactly beatLen later"
  it('steps exactly one beat', () => {
    const onThree = g.offset + 2 * beat + 0.2
    const next = stepBeat(onThree, 1, g, 60)
    expect(next).toBeCloseTo(g.offset + 3 * beat)
    expect(position(next, g).count).toBe(4)
    expect(position(stepBeat(next, -1, g, 60), g).count).toBe(3)
  })

  it('does not step before the first beat or past the end', () => {
    expect(stepBeat(g.offset, -1, g, 60)).toBeCloseTo(g.offset)
    expect(stepBeat(59.9, 1, g, 60)).toBe(60)
  })

  // Spec: "Loop on at bar 5 → after count 8 it returns to count 1 of bar 5"
  it('loops a bar', () => {
    expect(loopTarget(barStart(5, g) + 2, 5, g)).toBeNull()
    expect(loopTarget(barStart(6, g), 5, g)).toBeCloseTo(barStart(5, g))
    expect(loopTarget(barStart(2, g), 5, g)).toBeCloseTo(barStart(5, g))
  })

  it('counts whole bars after the offset', () => {
    expect(barCount(48, g)).toBe(9)
    expect(barCount(1, g)).toBe(1)
  })
})
