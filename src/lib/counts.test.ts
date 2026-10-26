import { describe, expect, it } from 'vitest'
import { barCount } from './beat'
import { gridFromMarks, marksProblem } from './counts'

describe('gridFromMarks', () => {
  it('derives tempo and first beat from counts 1 and 8', () => {
    // 120 BPM: a beat every 0.5 s, so 8 lands 3.5 s after 1.
    const g = gridFromMarks(2, 5.5)
    expect(g.bpm).toBeCloseTo(120)
    expect(g.offset).toBe(2)
  })

  it('feeds the bar split', () => {
    const g = gridFromMarks(1, 4.5) // 120 BPM, 4 s bars
    expect(barCount(41, g)).toBe(10)
  })
})

describe('marksProblem', () => {
  it('asks for each mark in turn', () => {
    expect(marksProblem(null, null)).toMatch(/count 1/)
    expect(marksProblem(1, null)).toMatch(/count 8/)
  })

  it('rejects 8 before 1 and implausible tempos', () => {
    expect(marksProblem(3, 2)).toMatch(/after/)
    expect(marksProblem(1, 1.5)).toMatch(/close/) // 840 BPM
    expect(marksProblem(1, 20)).toMatch(/far/) // ~22 BPM
  })

  it('accepts a normal bar', () => {
    expect(marksProblem(1, 4.5)).toBeNull()
  })
})
