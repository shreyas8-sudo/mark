// Display-only crop: place the whole video so the crop rect (normalised,
// in *source* coordinates) covers the stage, centred. Nothing is re-encoded.

export type Crop = { x: number; y: number; w: number; h: number }
export type Size = { w: number; h: number }

export const FULL_FRAME: Crop = { x: 0, y: 0, w: 1, h: 1 }

export type VideoBox = { left: number; top: number; width: number; height: number }

export function videoBox(stage: Size, video: Size, crop: Crop, mirror: boolean): VideoBox {
  const cropW = crop.w * video.w
  const cropH = crop.h * video.h
  const scale = Math.max(stage.w / cropW, stage.h / cropH)
  const width = video.w * scale
  const height = video.h * scale

  // Mirroring flips the frame around its own centre, so a crop that sits at
  // x on the source sits at 1 - x - w on screen.
  const cx = (mirror ? 1 - crop.x - crop.w / 2 : crop.x + crop.w / 2) * width
  const cy = (crop.y + crop.h / 2) * height

  return { left: stage.w / 2 - cx, top: stage.h / 2 - cy, width, height }
}
