import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Ambient } from '../components/Ambient'
import { BarCircles } from '../components/BarCircles'
import { BigCount } from '../components/BigCount'
import { Button, GlassButton, ModeCarousel, PlayShutter, ShortcutsButton } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { useKeys } from '../hooks/useKeys'
import { useLayout } from '../hooks/useLayout'
import { usePlayhead } from '../hooks/usePlayhead'
import { useVoiceCounts } from '../hooks/useVoiceCounts'
import { barEnd, barStart, beatLen, beatTime, COUNTS_PER_BAR, position } from '../lib/beat'
import { countIn } from '../lib/countIn'
import { IDLE, runReducer } from '../lib/runner'
import { formatSpeed } from '../lib/speed'
import type { Dance } from '../types'
import './Rehearse.css'

type Props = {
  dance: Dance
  src: string
  onEnd: () => void
  onBack: () => void
  onLearn: () => void
}

/** 08 Rehearse · Running: hands-free loops with a count-in. */
export function RehearseRun({ dance, src, onEnd, onBack, onLearn }: Props) {
  const { run } = dance
  const layout = useLayout()
  // Known up front from the stored size (iOS may hold back metadata until play).
  const [aspect, setAspect] = useState<number | null>(() =>
    dance.videoSize ? (dance.crop.w * dance.videoSize.w) / (dance.crop.h * dance.videoSize.h) : null,
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const reducer = useMemo(() => runReducer(run), [run])
  const [state, dispatch] = useReducer(reducer, IDLE, (s) => reducer(s, { type: 'start' }))
  const [shown, setShown] = useState<number | null>(null) // count-in numeral on screen

  const start = barStart(run.barStart, dance)
  const end = barEnd(run.barEnd, dance)
  const active = state.phase === 'countIn' || state.phase === 'playing' ? state : null
  const loop = active ? run.loops[active.loop] : null

  // The play (state.seq) the video is cued to the top of the range for, and
  // the play already reported finished, so each play ends exactly once.
  const cued = useRef<number | null>(null)
  const ended = useRef<number | null>(null)

  const { t } = usePlayhead(videoRef, (video) => {
    if (!active || active.phase !== 'playing' || active.paused) return
    if (video.currentTime >= end && ended.current !== active.seq) {
      ended.current = active.seq
      video.pause()
      dispatch({ type: 'reachedEnd' })
    }
  })

  // iOS only lets a video with sound start from a tap, or once that element
  // has been started by one. Every play() here comes later (the count-in
  // timer), so bless the element now: this mounts inside the Start tap, and
  // React commits a tap's update before the tap's event handling ends.
  useLayoutEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => {})
    v.pause()
  }, [])

  // Optional spoken counts over the music while the bars play (never in the
  // count-in, which stays as beeps). The run jumps back at the range end.
  useVoiceCounts(videoRef, {
    enabled: !!run.voice && state.phase === 'playing' && !active?.paused,
    grid: dance,
    volume: 0.7,
    stopAt: end,
  })

  const phase = state.phase
  const seq = active?.seq
  const paused = active?.paused
  const speed = loop?.speed
  const beat = beatLen(dance)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (seq == null || speed == null || paused) {
      video.pause()
      return
    }
    video.playbackRate = speed

    if (phase === 'countIn') {
      // Also the resume path: a paused count-in always starts again from 5.
      video.pause()
      video.currentTime = start
      cued.current = seq
      const cancel = countIn(
        beat / speed,
        (n) => setShown(n),
        () => {
          setShown(null)
          void video.play().catch(() => {})
          dispatch({ type: 'countInDone' })
        },
      )
      return () => {
        cancel()
        setShown(null)
      }
    }

    // A new play (repeat, or no count-in) starts at the top; a resume doesn't.
    if (cued.current !== seq) {
      video.currentTime = start
      cued.current = seq
    }
    if (video.paused) void video.play().catch(() => {})
  }, [phase, seq, paused, speed, start, beat])

  const total = run.loops.length
  const pill =
    state.phase === 'done'
      ? `Done · ${total} ${total === 1 ? 'loop' : 'loops'}`
      : active && loop
        ? `Loop ${active.loop + 1} of ${total} · ${formatSpeed(loop.speed)}`
        : ''
  const playing = !!active && !active.paused
  const desktop = layout === 'desktop'

  const togglePlay = () =>
    dispatch(state.phase === 'done' ? { type: 'restart' } : { type: playing ? 'pause' : 'resume' })
  const restart = () => dispatch({ type: 'restart' })
  const prev = () => dispatch({ type: 'prev' })
  const next = () => dispatch({ type: 'next' })

  const [keysOpen, setKeysOpen] = useState(false)
  useKeys({ ' ': togglePlay, r: restart, '[': prev, ']': next, '?': () => setKeysOpen((o) => !o), Escape: onEnd })

  // Jump to a count from the bar circles. In the count-in, that skips the
  // rest of it and plays from there.
  const seek = (bar: number, n: number) => {
    const video = videoRef.current
    if (!video || !active) return
    video.currentTime = beatTime((bar - 1) * COUNTS_PER_BAR + n - 1, dance)
    if (active.phase === 'countIn') dispatch({ type: 'countInDone' })
  }

  // A vertical clip stops above the dock, so nothing covers the dancer's
  // feet; a horizontal one fills the screen with the controls over it.
  const vertical = aspect != null && aspect < 1
  const dockRef = useRef<HTMLElement>(null)
  const [controlsH, setControlsH] = useState(0)
  useLayoutEffect(() => {
    const el = dockRef.current
    if (!el) return
    // From the top of the dock to the bottom of the screen (includes the
    // safe-area padding below it).
    const measure = () => setControlsH(window.innerHeight - el.getBoundingClientRect().top)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div
      className="rehearse-run"
      data-mode="rehearse"
      data-layout={layout}
      data-orient={aspect == null ? undefined : vertical ? 'v' : 'h'}
      style={{ ...(aspect ? { '--ar': aspect } : {}), '--controls-h': `${controlsH}px` } as CSSProperties}
    >
      <Ambient videoRef={videoRef} />
      {/* Same element in every layout, so the video never remounts. */}
      <div className="rehearse-run__stage">
        <VideoStage
          src={src}
          mirror={dance.mirror}
          crop={dance.crop}
          videoSize={dance.videoSize}
          fit="contain"
          videoRef={videoRef}
          onTap={togglePlay}
          onLoadedMetadata={(v) => setAspect((dance.crop.w * v.videoWidth) / (dance.crop.h * v.videoHeight))}
        />
      </div>
      <div className="rehearse-run__scrim rehearse-run__scrim--top" />
      <div className="rehearse-run__scrim rehearse-run__scrim--bottom" />

      <header className="rehearse-run__top">
        <GlassButton icon="back" label="Back to library" onClick={onBack} />
        <ModeCarousel mode="rehearse" onChange={(m) => m === 'learn' && onLearn()} />
        {desktop ? (
          <ShortcutsButton keys={SHORTCUTS} open={keysOpen} onToggle={() => setKeysOpen((o) => !o)} />
        ) : (
          <span className="rehearse-run__spacer" aria-hidden />
        )}
      </header>
      <span className="run-pill mk-glass mk-label-mono" aria-live="polite">
        <span className="run-pill__dot" data-live={playing || undefined} />
        {pill}
      </span>

      <div className="rehearse-run__bars">
        <BarCircles
          barStart={run.barStart}
          barEnd={run.barEnd}
          // Empty during the count-in; they fill only while the bars play.
          pos={state.phase === 'playing' ? position(t, dance) : null}
          done={state.phase === 'done'}
          onSeek={active ? seek : undefined}
        />
      </div>

      {/* The 5-6-7-8 count-in is big in the centre; counts 1–8 stay in the
          circles at the side. */}
      {shown != null && (
        <div className="rehearse-run__count-in">
          <BigCount count={shown} beat={shown} countIn />
        </div>
      )}

      {state.phase === 'done' && (
        <div className="run-done">
          <p className="mk-heading-l">Nice run.</p>
          <Button onClick={restart}>One more time</Button>
        </div>
      )}

      {/* One glass pill: Prev loop · Restart · Play/Pause · Next loop · End */}
      <footer ref={dockRef} className="rehearse-run__bottom">
        <nav className="run-dock mk-glass" aria-label="Transport">
          <GlassButton icon="prev" label="Previous loop" size={44} onClick={prev} />
          <GlassButton icon="restart" label="Restart loop" size={44} onClick={restart} />
          <PlayShutter playing={playing} onClick={togglePlay} />
          <GlassButton icon="next" label="Next loop" size={44} onClick={next} />
          <button type="button" className="run-dock__end mk-body-strong" aria-label="End run" onClick={onEnd}>
            <Icon name="close" size={20} />
            End<span className="run-dock__end-long">&nbsp;run</span>
          </button>
        </nav>
      </footer>
    </div>
  )
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Pause / play'],
  ['R', 'Restart loop'],
  ['[ ]', 'Prev / next loop'],
  ['Esc', 'End run'],
  ['?', 'Show shortcuts'],
]
