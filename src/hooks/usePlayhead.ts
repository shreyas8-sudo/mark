import { useEffect, useRef, useState, type RefObject } from 'react'

export type Playhead = { t: number; playing: boolean }

/**
 * Tracks video.currentTime every presented frame (requestVideoFrameCallback,
 * falling back to rAF). `onFrame` runs before state updates so callers can
 * seek, e.g. to loop a bar, without a frame of overshoot rendering.
 */
export function usePlayhead(
  ref: RefObject<HTMLVideoElement | null>,
  onFrame?: (video: HTMLVideoElement) => void,
): Playhead {
  const [state, setState] = useState<Playhead>({ t: 0, playing: false })
  const onFrameRef = useRef(onFrame)
  useEffect(() => {
    onFrameRef.current = onFrame
  })

  useEffect(() => {
    const video = ref.current
    if (!video) return
    let handle = 0
    let stopped = false
    const hasVfc = 'requestVideoFrameCallback' in video

    const sync = () => setState({ t: video.currentTime, playing: !video.paused })

    const tick = () => {
      if (stopped) return
      onFrameRef.current?.(video)
      sync()
      schedule()
    }
    const schedule = () => {
      handle = hasVfc ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick)
    }
    const cancel = () =>
      hasVfc ? video.cancelVideoFrameCallback(handle) : cancelAnimationFrame(handle)

    // Frame callbacks stall when the page isn't rendering (background tab,
    // hidden pane); timeupdate still fires ~4×/s, so loops can't run away.
    const backstop = () => onFrameRef.current?.(video)

    const events = ['play', 'pause', 'seeked', 'loadedmetadata', 'ratechange']
    events.forEach((e) => video.addEventListener(e, sync))
    video.addEventListener('timeupdate', backstop)
    schedule()
    return () => {
      stopped = true
      cancel()
      events.forEach((e) => video.removeEventListener(e, sync))
      video.removeEventListener('timeupdate', backstop)
    }
  }, [ref])

  return state
}
