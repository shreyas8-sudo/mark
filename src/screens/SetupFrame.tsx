import { useLayoutEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { Button, GlassButton, Segmented, Toggle } from '../components/controls'
import { Icon } from '../components/Icon'
import { useVideoRef } from '../hooks/useVideoRef'
import cornerBl from '../assets/crop/corner-bl.svg'
import cornerBr from '../assets/crop/corner-br.svg'
import cornerTl from '../assets/crop/corner-tl.svg'
import cornerTr from '../assets/crop/corner-tr.svg'
import {
  ASPECT,
  cropFromFraming,
  framingFromCrop,
  normalise,
  videoBox,
  type Crop,
  type Framing,
  type Size,
} from '../lib/crop'
import type { Dance } from '../types'
import './SetupFrame.css'

type Orientation = Dance['orientation']
export type FrameSettings = { crop: Crop; mirror: boolean; orientation: Orientation; videoSize?: Size }

type Props = {
  src: string
  initial: FrameSettings
  onBack: () => void
  onSave: (settings: FrameSettings) => void
}

const CENTRE: Framing = { z: 1, cx: 0.5, cy: 0.5 }
const BOX_INSET = 24

/** 03 Setup · Frame: pinch/drag (touch) or drag/scroll (mouse) the video under a fixed box. */
export function SetupFrame({ src, initial, onBack, onSave }: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState<Size | null>(null)
  const [video, setVideo] = useState<Size | null>(null)
  const [mirror, setMirror] = useState(initial.mirror)
  const [orientation, setOrientation] = useState<Orientation>(initial.orientation)
  const [framing, setFraming] = useState<Framing | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const videoRef = useVideoRef(src)

  useLayoutEffect(() => {
    const el = areaRef.current!
    const r = el.getBoundingClientRect() // see VideoStage: don't wait for a frame
    setArea({ w: r.width, h: r.height })
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const aspect = ASPECT[orientation]

  // Largest box of the chosen aspect that fits the free area.
  const box = area && fitBox(area, aspect)
  const crop = video && framing ? cropFromFraming(video, aspect, framing) : null
  const vb = box && video && crop ? videoBox(box, video, crop, mirror) : null

  const update = (fn: (f: Framing) => Framing) =>
    setFraming((f) => (f && video ? normalise(video, aspect, fn(f)) : f))

  const pan = (dx: number, dy: number) => {
    if (!crop || !box) return
    // Screen px → normalised source units; a mirrored frame pans the other way.
    const sx = (mirror ? 1 : -1) * (dx / box.w) * crop.w
    const sy = -(dy / box.h) * crop.h
    update((f) => ({ ...f, cx: f.cx + sx, cy: f.cy + sy }))
  }

  const onPointerDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const onPointerMove = (e: PointerEvent) => {
    const ps = pointers.current
    const prev = ps.get(e.pointerId)
    if (!prev) return
    const next = { x: e.clientX, y: e.clientY }
    if (ps.size === 1) {
      pan(next.x - prev.x, next.y - prev.y)
    } else if (ps.size === 2) {
      const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1]
      const before = Math.hypot(prev.x - other.x, prev.y - other.y)
      const after = Math.hypot(next.x - other.x, next.y - other.y)
      if (before > 0) update((f) => ({ ...f, z: f.z * (after / before) }))
      // Half the midpoint shift, since only one finger moved this event.
      pan((next.x - prev.x) / 2, (next.y - prev.y) / 2)
    }
    ps.set(e.pointerId, next)
  }
  const onPointerUp = (e: PointerEvent) => pointers.current.delete(e.pointerId)
  const onWheel = (e: WheelEvent) => update((f) => ({ ...f, z: f.z * Math.exp(-e.deltaY * 0.002) }))

  const switchOrientation = (o: Orientation) => {
    setOrientation(o)
    if (video && framing) setFraming(normalise(video, ASPECT[o], framing))
  }

  return (
    <main className="setup" data-mode="learn">
      <div
        ref={areaRef}
        className="setup__area"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <video
          ref={videoRef}
          className="setup__video"
          src={src}
          muted
          loop
          autoPlay
          playsInline
          style={
            vb && box
              ? {
                  left: box.left + vb.left,
                  top: box.top + vb.top,
                  width: vb.width,
                  height: vb.height,
                  transform: mirror ? 'scaleX(-1)' : undefined,
                }
              : { visibility: 'hidden' }
          }
          onLoadedMetadata={(e) => {
            const size = { w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight }
            setVideo(size)
            setFraming(framingFromCrop(size, aspect, initial.crop))
          }}
        />
        {box && (
          <div className="setup__box" style={{ left: box.left, top: box.top, width: box.w, height: box.h }}>
            <img src={cornerTl} alt="" width={26} height={26} className="setup__corner setup__corner--tl" />
            <img src={cornerTr} alt="" width={26} height={26} className="setup__corner setup__corner--tr" />
            <img src={cornerBr} alt="" width={26} height={26} className="setup__corner setup__corner--br" />
            <img src={cornerBl} alt="" width={26} height={26} className="setup__corner setup__corner--bl" />
          </div>
        )}
      </div>

      <header className="setup__top">
        <GlassButton icon="back" label="Back" onClick={onBack} />
        <span className="mk-body-strong">Set up</span>
        <span className="setup__hint mk-label">Pinch · Drag</span>
      </header>

      <section className="setup__sheet">
        <h1 className="mk-heading-m">Frame your dancer</h1>
        <p className="mk-body-small">
          Zoom in on who you’re learning from. You can change it later.
        </p>
        <Segmented
          label="Frame shape"
          value={orientation}
          options={[
            { value: 'vertical', label: 'Vertical' },
            { value: 'horizontal', label: 'Horizontal' },
          ]}
          onChange={switchOrientation}
        />
        <div className="setup__row">
          <Icon name="mirror" size={24} />
          <span className="mk-body-strong">Mirror video</span>
          <Toggle label="Mirror video" on={mirror} onChange={setMirror} />
        </div>
        <div className="setup__actions">
          <Button variant="secondary" onClick={() => setFraming(CENTRE)}>
            Reset
          </Button>
          <Button disabled={!crop} onClick={() => crop && onSave({ crop, mirror, orientation, videoSize: video ?? undefined })}>
            Looks right
          </Button>
        </div>
      </section>
    </main>
  )
}

function fitBox(area: Size, aspect: number) {
  const top = 104 // clear the header
  const sheetOverlap = 32 // the sheet's rounded top sits over the area
  const availW = area.w - 2 * BOX_INSET
  const availH = area.h - top - sheetOverlap - BOX_INSET
  const w = Math.min(availW, availH * aspect)
  const h = w / aspect
  return { left: (area.w - w) / 2, top: top + (availH - h) / 2, w, h }
}
