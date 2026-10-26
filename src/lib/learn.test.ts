import { describe, expect, it } from 'vitest'
import { followLearned, lastLearned, markLearned, unmarkLearned } from './learn'

const run = { barStart: 1, barEnd: 1, countIn: true, loops: [] }

describe('guided learn', () => {
  it('marks bars learned once, in order', () => {
    expect(markLearned([3, 1], 2)).toEqual([1, 2, 3])
    expect(markLearned([1, 2], 2)).toEqual([1, 2])
    expect(unmarkLearned([1, 2, 3], 2)).toEqual([1, 3])
  })

  it('treats nothing learned as bar 1', () => {
    expect(lastLearned([])).toBe(1)
    expect(lastLearned([1, 4, 2])).toBe(4)
  })

  // Spec: "Learned 1–3 → Rehearse: range preset to 1 → 3, can drag to 5"
  it('moves the default Rehearse range along with learned bars', () => {
    let r = followLearned(run, [], [1])
    r = followLearned(r, [1], [1, 2])
    r = followLearned(r, [1, 2], [1, 2, 3])
    expect(r).toMatchObject({ barStart: 1, barEnd: 3 })
  })

  it('leaves a range the dancer changed alone', () => {
    const dragged = { ...run, barEnd: 5 }
    expect(followLearned(dragged, [1, 2, 3], [1, 2, 3, 4])).toBe(dragged)
  })

  it('pulls the range back when the last learned bar is unticked', () => {
    expect(followLearned({ ...run, barEnd: 3 }, [1, 2, 3], [1, 2])).toMatchObject({ barEnd: 2 })
  })
})
