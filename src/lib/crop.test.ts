import { describe, expect, it } from 'vitest'
import {
  ASPECT,
  cropFromFraming,
  framingFromCrop,
  FULL_FRAME,
  normalise,
  videoBox,
} from './crop'

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

  it('auto-fit shows a whole vertical crop on a landscape stage', () => {
    const landscapePhone = { w: 844, h: 390 }
    const box = videoBox(landscapePhone, { w: 540, h: 1172 }, FULL_FRAME, false, 'auto')
    expect(box.height).toBeCloseTo(390)
    expect(box.width).toBeLessThan(844)
    expect(box.left + box.width / 2).toBeCloseTo(422)
    // same way up → still covers
    expect(videoBox(phone, { w: 540, h: 1172 }, FULL_FRAME, false, 'auto').width).toBeGreaterThanOrEqual(phone.w)
  })

  it('mirrors the crop position horizontally', () => {
    const crop = { x: 0.5, y: 0, w: 0.5, h: 1 }
    const box = videoBox({ w: 100, h: 200 }, { w: 100, h: 100 }, crop, true)
    // source right half shows on the left once flipped
    expect(box.left).toBeCloseTo(0)
  })
})

describe('framing', () => {
  const portrait = { w: 540, h: 1172 } // the demo clip
  const landscape = { w: 1920, h: 1080 }

  it('at zoom 1 takes the largest box of the chosen aspect', () => {
    const c = cropFromFraming(landscape, ASPECT.vertical, { z: 1, cx: 0.5, cy: 0.5 })
    expect(c.h).toBe(1)
    expect((c.w * landscape.w) / (c.h * landscape.h)).toBeCloseTo(9 / 16)
    expect(c.x + c.w / 2).toBeCloseTo(0.5)
  })

  it('zooming shrinks the crop around the centre', () => {
    const c = cropFromFraming(portrait, ASPECT.vertical, { z: 2, cx: 0.5, cy: 0.5 })
    const c1 = cropFromFraming(portrait, ASPECT.vertical, { z: 1, cx: 0.5, cy: 0.5 })
    expect(c.w).toBeCloseTo(c1.w / 2)
    expect(c.x + c.w / 2).toBeCloseTo(0.5)
  })

  it('keeps the crop inside the video when panned past the edge', () => {
    const c = cropFromFraming(landscape, ASPECT.vertical, { z: 1, cx: 0.99, cy: 0.5 })
    expect(c.x + c.w).toBeCloseTo(1)
    expect(normalise(landscape, ASPECT.vertical, { z: 1, cx: 0.99, cy: 0.5 }).cx).toBeCloseTo(1 - c.w / 2)
  })

  it('round-trips a crop back to the same framing', () => {
    const f = { z: 2.5, cx: 0.4, cy: 0.6 }
    const back = framingFromCrop(portrait, ASPECT.vertical, cropFromFraming(portrait, ASPECT.vertical, f))
    expect(back.z).toBeCloseTo(f.z)
    expect(back.cx).toBeCloseTo(f.cx)
    expect(back.cy).toBeCloseTo(f.cy)
  })

  it('treats the full frame as zoom 1', () => {
    expect(framingFromCrop(portrait, ASPECT.vertical, FULL_FRAME).z).toBe(1)
  })
})
