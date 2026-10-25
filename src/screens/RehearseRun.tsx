import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Button, GlassButton, PlayShutter } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { usePlayhead } from '../hooks/usePlayhead'
import { barEnd, barStart, beatLen } from '../lib/beat'
import { countIn } from '../lib/countIn'
import { IDLE, runReducer } from '../lib/runner'
import { formatSpeed } from '../lib/speed'
import type { Dance } from '../types'
import './Rehearse.css'

type Props = {
  dance: Dance
  src: string
  onEnd: () => void
}

/** 08 Rehearse · Running: hands-free loops with a count-in. */
export function RehearseRun({ dance, src, onEnd }: Props) {
  const { run } = dance
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

  usePlayhead(videoRef, (video) => {
    if (!active || active.phase !== 'playing' || active.paused) return
    if (video.currentTime >= end && ended.current !== active.seq) {
      ended.current = active.seq
      video.pause()
      dispatch({ type: 'reachedEnd' })
    }
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

  return (
    <div className="rehearse-run" data-mode="rehearse">
      <VideoStage src={src} mirror={dance.mirror} crop={dance.crop} videoRef={videoRef} />
      <div className="rehearse-run__dim" />
      <div className="rehearse-run__scrim" />

      <div className="rehearse-run__ui">
        <header className="rehearse-run__top">
          <span className="run-pill mk-glass mk-label-mono" aria-live="polite">
            <span className="run-pill__dot" data-live={playing || undefined} />
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
          <GlassButton icon="restart" label="Restart loop" size={50} iconSize={24} onClick={() => dispatch({ type: 'restart' })} />
        </div>

        <div className="rehearse-run__middle">
          {shown != null && (
            <div className="count-in mk-count-display mk-over-video" aria-live="assertive">
              {shown}
            </div>
          )}
          {state.phase === 'done' && (
            <div className="run-done">
              <p className="mk-heading-l">Nice run.</p>
              <Button onClick={() => dispatch({ type: 'restart' })}>Run it again</Button>
            </div>
          )}
        </div>

        <footer className="rehearse-run__bottom">
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
              <GlassButton icon="prev" label="Previous loop" size={50} iconSize={18} onClick={() => dispatch({ type: 'prev' })} />
              <span className="mk-label-mono">Prev loop</span>
            </div>
            <div className="run-transport__item">
              <PlayShutter
                className="shutter shutter--lg"
                iconSize={30}
                playing={playing}
                onClick={() =>
                  dispatch(
                    state.phase === 'done' ? { type: 'restart' } : { type: playing ? 'pause' : 'resume' },
                  )
                }
              />
              <span className="mk-label-mono">{playing ? 'Pause' : 'Play'}</span>
            </div>
            <div className="run-transport__item">
              <GlassButton icon="next" label="Next loop" size={50} iconSize={18} onClick={() => dispatch({ type: 'next' })} />
              <span className="mk-label-mono">Next loop</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
