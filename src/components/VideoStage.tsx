import { useLayoutEffect, useRef, useState, type Ref } from 'react'
import { useVideoRef } from '../hooks/useVideoRef'
import { videoBox, type Crop, type Fit, type Size } from '../lib/crop'

type Props = {
  src: string
  mirror: boolean
  crop: Crop
  videoRef: Ref<HTMLVideoElement>
  fit?: Fit
  /** The clip's pixel size if already known, so the crop applies at once. */
  videoSize?: Size
  /** Tap on the video itself (not on controls floating over it). */
  onTap?: () => void
  onLoadedMetadata?: (video: HTMLVideoElement) => void
}

export function VideoStage({ src, mirror, crop, videoRef, fit = 'auto', videoSize, onTap, onLoadedMetadata }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const ref = useVideoRef(src, videoRef)
  const [stage, setStage] = useState<Size | null>(null)
  // Keyed by src so a new clip never renders with the old clip's size.
  const [loaded, setLoaded] = useState<{ src: string; size: Size } | null>(null)
  const video = loaded?.src === src ? loaded.size : (videoSize ?? null)

  useLayoutEffect(() => {
    const el = stageRef.current!
    // Measure now: ResizeObserver only reports on a rendered frame, which a
    // background tab may not get for a while.
    const r = el.getBoundingClientRect()
    setStage({ w: r.width, h: r.height })
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setStage({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const box = stage && video ? videoBox(stage, video, crop, mirror, fit) : null

  return (
    // The tap is a convenience; Play/Pause stays a visible, labelled button.
    <div ref={stageRef} className="video-stage" data-tappable={onTap ? true : undefined} onClick={onTap}>
      <video
        ref={ref}
        src={src}
        playsInline
        preload="auto"
        className="video-stage__video"
        style={
          box
            ? {
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
                transform: mirror ? 'scaleX(-1)' : undefined,
              }
            : // Size unknown yet (iOS may not load metadata before the first
              // play, and older dances didn't store it): fill the stage
              // rather than show nothing.
              { inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: mirror ? 'scaleX(-1)' : undefined }
        }
        onLoadedMetadata={(e) => {
          const v = e.currentTarget as HTMLVideoElement & { webkitPreservesPitch?: boolean }
          v.preservesPitch = true
          v.webkitPreservesPitch = true // Safari < 17
          setLoaded({ src, size: { w: v.videoWidth, h: v.videoHeight } })
          onLoadedMetadata?.(v)
          // A paused video that has never seeked shows black on iOS, not its
          // first frame; seeking forces one to decode.
          if (v.currentTime === 0) v.currentTime = 0.001
        }}
      />
    </div>
  )
}
