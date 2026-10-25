import { describe, expect, it } from 'vitest'
import { FULL_FRAME, videoBox } from './crop'

const phone = { w: 390, h: 844 }

describe('videoBox', () => {
  it('covers the stage with a full-frame vertical video', () => {
    const box = videoBox(phone, { w: 1080, h: 1920 }, FULL_FRAME, false)
    expect(box.width).toBeGreaterThanOrEqual(phone.w)
    expect(box.height).toBeCloseTo(phone.h)
    expect(box.left + box.width / 2).toBeCloseTo(phone.w / 2)
  })

  it('zooms so the crop rect fills the stage', () => {
    const crop = { x: 0.5, y: 0.25, w: 0.5, h: 0.5 }
    const box = videoBox({ w: 100, h: 100 }, { w: 100, h: 100 }, crop, false)
    expect(box.width).toBe(200)
    // crop's left edge (x=0.5 → 100px into the video) lands on the stage edge
    expect(box.left + 0.5 * box.width).toBeCloseTo(0)
    expect(box.top + 0.25 * box.height).toBeCloseTo(0)
  })

  it('mirrors the crop position horizontally', () => {
    const crop = { x: 0.5, y: 0, w: 0.5, h: 1 }
    const box = videoBox({ w: 100, h: 200 }, { w: 100, h: 100 }, crop, true)
    // source right half shows on the left once flipped
    expect(box.left).toBeCloseTo(0)
  })
})
