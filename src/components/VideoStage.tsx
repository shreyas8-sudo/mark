import { useLayoutEffect, useRef, useState, type Ref } from 'react'
import { videoBox, type Crop, type Fit, type Size } from '../lib/crop'

type Props = {
  src: string
  mirror: boolean
  crop: Crop
  videoRef: Ref<HTMLVideoElement>
  fit?: Fit
  onLoadedMetadata?: (video: HTMLVideoElement) => void
}

export function VideoStage({ src, mirror, crop, videoRef, fit = 'auto', onLoadedMetadata }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<Size | null>(null)
  // Keyed by src so a new clip never renders with the old clip's size.
  const [loaded, setLoaded] = useState<{ src: string; size: Size } | null>(null)
  const video = loaded?.src === src ? loaded.size : null

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
    <div ref={stageRef} className="video-stage">
      <video
        ref={videoRef}
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
            : { visibility: 'hidden' }
        }
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          v.preservesPitch = true
          setLoaded({ src, size: { w: v.videoWidth, h: v.videoHeight } })
          onLoadedMetadata?.(v)
        }}
      />
    </div>
  )
}
