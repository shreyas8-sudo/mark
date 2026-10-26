import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Ambient } from '../components/Ambient'
import { BigCount } from '../components/BigCount'
import { Button, DeskTopBar, GlassButton, PlayShutter, ShortcutsButton } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { useKeys } from '../hooks/useKeys'
import { useLayout } from '../hooks/useLayout'
import { usePlayhead } from '../hooks/usePlayhead'
import { useVoiceCounts } from '../hooks/useVoiceCounts'
import { barEnd, barStart, beatLen, COUNTS_PER_BAR, position } from '../lib/beat'
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
  const [aspect, setAspect] = useState<number | null>(null)
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

  // Phone portrait: the video gets everything above the controls.
  const footerRef = useRef<HTMLElement>(null)
  const [controlsH, setControlsH] = useState(0)
  useLayoutEffect(() => {
    const el = footerRef.current
    if (!el || layout !== 'portrait') return setControlsH(0)
    // From the top of the controls to the bottom of the screen (includes
    // the safe-area padding below them).
    const measure = () => setControlsH(window.innerHeight - el.getBoundingClientRect().top)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout])

  // The big count: 5-6-7-8 in the accent during the count-in, then the
  // dance's own counts while the bars play.
  const pos = position(t, dance)
  const count =
    shown != null ? <BigCount count={shown} beat={shown} countIn />
    : state.phase === 'playing' ? <BigCount count={pos.count} beat={pos.beatIndex} />
    : <BigCount count={null} beat={0} />

  const doneCard = state.phase === 'done' && (
    <div className="run-done">
      <p className="mk-heading-l">Nice run.</p>
      <Button onClick={restart}>Run it again</Button>
    </div>
  )
  const statusDot = <span className="run-pill__dot" data-live={playing || undefined} />

  return (
    <div
      className={`rehearse-run${desktop ? ' desk' : ''}`}
      data-mode="rehearse"
      data-layout={layout}
      style={{ ...(aspect ? { '--ar': aspect } : {}), '--controls-h': `${controlsH}px` } as CSSProperties}
    >
      {/* Same position in every layout, so the video never remounts. */}
      <div className={desktop ? 'desk-frame' : 'rehearse-run__stage'}>
        <VideoStage
          src={src}
          mirror={dance.mirror}
          crop={dance.crop}
          fit="contain"
          videoRef={videoRef}
          onTap={togglePlay}
          onLoadedMetadata={(v) => setAspect((dance.crop.w * v.videoWidth) / (dance.crop.h * v.videoHeight))}
        />
        {desktop && <div className="desk-frame__center">{doneCard}</div>}
      </div>

      {desktop ? (
        <>
          <Ambient videoRef={videoRef} />
          <DeskTopBar
            title={dance.name}
            meta={`Bars ${run.barStart} → ${run.barEnd} · ${Math.round(dance.bpm)} BPM`}
            mode="rehearse"
            onBack={onBack}
            onMode={onLearn}
            right={<ShortcutsButton keys={SHORTCUTS} open={keysOpen} onToggle={() => setKeysOpen((o) => !o)} />}
          />
          <div className="desk-count">{count}</div>
          {/* One row, ≤72px: bar timeline · transport · loop pill · End */}
          <footer className="desk-dock">
            <BeatTimeline
              barStart={run.barStart}
              barEnd={run.barEnd}
              // Empty during the count-in; it fills only while the bars play.
              t={state.phase === 'playing' ? t : null}
              grid={dance}
            />
            <div className="desk-dock__transport">
              <GlassButton icon="prev" label="Previous loop" size={40} iconSize={16} onClick={prev} />
              <GlassButton icon="restart" label="Restart loop" size={40} iconSize={18} onClick={restart} />
              <PlayShutter playing={playing} onClick={togglePlay} />
              <GlassButton icon="next" label="Next loop" size={40} iconSize={16} onClick={next} />
            </div>
            <div className="desk-dock__end">
              <span className="run-status mk-label-mono" aria-live="polite">
                {statusDot}
                {pill}
              </span>
              <button type="button" className="end-btn end-btn--dock mk-body-strong" onClick={onEnd}>
                <Icon name="close" size={18} />
                End
              </button>
            </div>
          </footer>
        </>
      ) : (
        <>
          <div className="rehearse-run__scrim" />

          <div className="rehearse-run__ui">
            <header className="rehearse-run__top">
              <span className="run-pill mk-glass mk-label-mono" aria-live="polite">
                {statusDot}
                {pill}
              </span>
              <span className="rehearse-run__bars mk-label-mono mk-over-video">
                Bars {run.barStart} → {run.barEnd}
              </span>
            </header>
            <div className="rehearse-run__actions">
              <button type="button" className="end-btn mk-glass mk-body-strong" onClick={onEnd}>
                <Icon name="close" size={18} />
                End rehearsal
              </button>
              <GlassButton icon="restart" label="Restart loop" size={50} iconSize={24} onClick={restart} />
            </div>

            <div className="rehearse-run__middle">
              {count}
              {doneCard}
            </div>

            <footer ref={footerRef} className="rehearse-run__bottom">
              <div className="loop-chips" role="tablist" aria-label="Loops">
                {run.loops.map((l, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={active?.loop === i}
                    aria-label={`Loop ${i + 1}, ${formatSpeed(l.speed)}`}
                    className="loop-chip mk-glass mk-data-mono"
                    data-active={active?.loop === i || undefined}
                    data-done={(state.phase === 'done' || (active && i < active.loop)) || undefined}
                    onClick={() => dispatch({ type: 'goto', loop: i })}
                  >
                    {formatSpeed(l.speed)}
                  </button>
                ))}
              </div>
              <div className="run-transport">
                <div className="run-transport__item">
                  <GlassButton icon="prev" label="Previous loop" size={50} iconSize={18} onClick={prev} />
                  <span className="mk-label-mono">Prev loop</span>
                </div>
                <div className="run-transport__item">
                  <PlayShutter className="shutter shutter--lg" iconSize={30} playing={playing} onClick={togglePlay} />
                  <span className="mk-label-mono">{playing ? 'Pause' : 'Play'}</span>
                </div>
                <div className="run-transport__item">
                  <GlassButton icon="next" label="Next loop" size={50} iconSize={18} onClick={next} />
                  <span className="mk-label-mono">Next loop</span>
                </div>
              </div>
            </footer>
          </div>
        </>
      )}
    </div>
  )
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Pause / play'],
  ['R', 'Restart loop'],
  ['[ ]', 'Prev / next loop'],
  ['Esc', 'End rehearsal'],
  ['?', 'Show shortcuts'],
]

/** Laptop: one segment per beat across the bar range, filled as it plays. */
function BeatTimeline({
  barStart: first,
  barEnd: last,
  t,
  grid,
}: {
  barStart: number
  barEnd: number
  t: number | null
  grid: { bpm: number; offset: number }
}) {
  const pos = t == null ? null : position(t, grid)
  const bars = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const state = (bar: number, count: number) => {
    if (!pos) return 'next'
    if (bar < pos.bar || (bar === pos.bar && count < pos.count)) return 'past'
    return bar === pos.bar && count === pos.count ? 'now' : 'next'
  }
  return (
    <div className="beat-timeline" role="img" aria-label={pos ? `Bar ${pos.bar}, count ${pos.count}` : 'Not started'}>
      {bars.map((b) => (
        <div key={b} className="beat-timeline__bar">
          <div className="beat-timeline__beats">
            {Array.from({ length: COUNTS_PER_BAR }, (_, i) => (
              <span key={i} data-state={state(b, i + 1)} />
            ))}
          </div>
          <span className="mk-label-mono" data-now={pos?.bar === b || undefined}>
            Bar {b}
            {pos?.bar === b && ` · Count ${pos.count}`}
          </span>
        </div>
      ))}
    </div>
  )
}
