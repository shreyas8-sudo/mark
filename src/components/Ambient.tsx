import { useEffect, useRef, type RefObject } from 'react'

/**
 * Blurred ambient backdrop for the laptop / TV layouts: a tiny canvas
 * sampled from the playing video a few times a second, scaled up and
 * blurred by CSS. Far cheaper than decoding the video twice.
 */
export function Ambient({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const draw = () => {
      const v = videoRef.current
      if (v && v.readyState >= 2) ctx.drawImage(v, 0, 0, 32, 32)
    }
    draw()
    const id = window.setInterval(draw, 400)
    return () => clearInterval(id)
  }, [videoRef])

  return (
    <div className="ambient" aria-hidden>
      <canvas ref={canvasRef} width={32} height={32} />
    </div>
  )
}
