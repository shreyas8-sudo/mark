// Display-only crop: place the whole video so the crop rect (normalised,
// in *source* coordinates) covers the stage, centred. Nothing is re-encoded.

export type Crop = { x: number; y: number; w: number; h: number }
export type Size = { w: number; h: number }

export const FULL_FRAME: Crop = { x: 0, y: 0, w: 1, h: 1 }

export type VideoBox = { left: number; top: number; width: number; height: number }

/**
 * 'cover' fills the stage (trimming the crop's long side); 'contain' shows
 * the whole crop with bars. 'auto' covers when the crop and the stage are
 * the same way up, and contains when they aren't (a vertical clip on a
 * landscape phone would otherwise lose most of the dancer).
 */
export type Fit = 'cover' | 'contain' | 'auto'

export function videoBox(stage: Size, video: Size, crop: Crop, mirror: boolean, fit: Fit = 'cover'): VideoBox {
  const cropW = crop.w * video.w
  const cropH = crop.h * video.h
  const contain = fit === 'contain' || (fit === 'auto' && cropW < cropH !== stage.w < stage.h)
  const scale = (contain ? Math.min : Math.max)(stage.w / cropW, stage.h / cropH)
  const width = video.w * scale
  const height = video.h * scale

  // Mirroring flips the frame around its own centre, so a crop that sits at
  // x on the source sits at 1 - x - w on screen.
  const cx = (mirror ? 1 - crop.x - crop.w / 2 : crop.x + crop.w / 2) * width
  const cy = (crop.y + crop.h / 2) * height

  return { left: stage.w / 2 - cx, top: stage.h / 2 - cy, width, height }
}

// ---- Framing: how Setup · Frame edits a crop ----
// The crop box on screen has a fixed aspect (vertical 9:16 / horizontal
// 16:9). The user zooms (z ≥ 1, 1 = largest box that fits the video) and
// pans the centre (cx, cy in normalised source coordinates).

export type Framing = { z: number; cx: number; cy: number }

export const MAX_ZOOM = 6
export const ASPECT = { vertical: 9 / 16, horizontal: 16 / 9 } as const

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Normalised size of the crop at zoom 1: the largest `aspect` rect in the video. */
function baseSize(video: Size, aspect: number) {
  const fitsHeight = video.w / video.h > aspect
  const w = fitsHeight ? (video.h * aspect) / video.w : 1
  const h = fitsHeight ? 1 : video.w / aspect / video.h
  return { w, h }
}

export function cropFromFraming(video: Size, aspect: number, f: Framing): Crop {
  const base = baseSize(video, aspect)
  const z = clamp(f.z, 1, MAX_ZOOM)
  const w = base.w / z
  const h = base.h / z
  return {
    x: clamp(f.cx - w / 2, 0, 1 - w),
    y: clamp(f.cy - h / 2, 0, 1 - h),
    w,
    h,
  }
}

export function framingFromCrop(video: Size, aspect: number, crop: Crop): Framing {
  const base = baseSize(video, aspect)
  const z = clamp(base.w / crop.w, 1, MAX_ZOOM)
  return normalise(video, aspect, { z, cx: crop.x + crop.w / 2, cy: crop.y + crop.h / 2 })
}

/** Clamp zoom and pull the centre back so the crop stays inside the video. */
export function normalise(video: Size, aspect: number, f: Framing): Framing {
  const c = cropFromFraming(video, aspect, f)
  return { z: clamp(f.z, 1, MAX_ZOOM), cx: c.x + c.w / 2, cy: c.y + c.h / 2 }
}
