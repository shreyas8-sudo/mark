import { useCallback, useEffect, useRef, useState } from 'react'
import { BigCount } from '../components/BigCount'
import { Button, GlassButton, Segmented } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { useKeys } from '../hooks/useKeys'
import { usePlayhead } from '../hooks/usePlayhead'
import { COUNTS_PER_BAR, position, type Grid } from '../lib/beat'
import { mediaToCtx } from '../lib/beatClock'
import { gridFromMarks, marksProblem } from '../lib/counts'
import { audioContext, unlockAudio } from '../lib/countIn'
import { loadVoices, playVoices, type Scheduled, type VoiceName } from '../lib/voice'
import type { Dance } from '../types'
import './FirstBeat.css'

const LEAD = 1 // seconds of video before the first previewed count
const PREVIEW_BARS = 2 // long enough to hear whether the counts drift

type Phase = 'ready' | 'marking' | 'preview'
type Rate = '1' | '0.5'

type Props = {
  dance: Dance
  src: string
  /** Beat detection failed, rather than the dancer asking to fix the counts. */
  noBeat?: boolean
  step?: string
  onBack: () => void
  onSave: (grid: Grid) => void
}

/**
 * Setup · Mark your counts: the dancer presses Play once and, in the same
 * playthrough, taps Mark 1 when count 1 hits and Mark 8 when count 8 of
 * that bar hits. Tempo and bars follow from those two taps; a spoken
 * preview checks them. Used when beat detection fails, and from "Fix counts".
 */
export function SetCounts({ dance, src, noBeat, step, onBack, onSave }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [rate, setRate] = useState<Rate>('1')
  const [t1, setT1] = useState<number | null>(null)
  const [t8, setT8] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [endedEarly, setEndedEarly] = useState(false)
  const previewEnd = useRef(0)
  const voices = useRef<Scheduled | null>(null)

  const problem = t1 != null && t8 != null ? marksProblem(t1, t8) : null
  const grid = t1 != null && t8 != null && !problem ? gridFromMarks(t1, t8) : null

  useEffect(() => {
    void loadVoices() // warm up so the preview starts on time
  }, [])

  const stop = useCallback(() => {
    voices.current?.cancel()
    voices.current = null
    videoRef.current?.pause()
    setPreviewing(false)
  }, [])
  useEffect(() => stop, [stop])

  const { t } = usePlayhead(videoRef, (v) => {
    if (previewing && v.currentTime >= previewEnd.current) stop()
  })

  // The clip ran out before both marks: start again.
  useEffect(() => {
    const v = videoRef.current
    if (!v || phase !== 'marking') return
    const onEnded = () => {
      setPhase('ready')
      setEndedEarly(true)
    }
    v.addEventListener('ended', onEnded)
    return () => v.removeEventListener('ended', onEnded)
  }, [phase])

  /** One playthrough from the top; the marks are taken from it. */
  const play = () => {
    const v = videoRef.current
    if (!v) return
    stop()
    setT1(null)
    setT8(null)
    setEndedEarly(false)
    v.currentTime = 0
    v.playbackRate = Number(rate)
    v.muted = false
    void v.play().catch(() => {})
    setPhase('marking')
  }

  /** Play from just before count 1 with the counts spoken over it. */
  const preview = (a = t1, b = t8) => {
    const v = videoRef.current
    if (previewing) return stop()
    if (!v || a == null || b == null || marksProblem(a, b)) return
    const beat = 60 / gridFromMarks(a, b).bpm
    const counts = Array.from({ length: COUNTS_PER_BAR * PREVIEW_BARS }, (_, i) => ({
      name: String((i % COUNTS_PER_BAR) + 1) as VoiceName,
      media: a + i * beat,
    })).filter((c) => c.media <= dance.duration)
    previewEnd.current = Math.min(dance.duration, counts[counts.length - 1].media + beat * 0.9)

    unlockAudio()
    // play() stays inside the tap (iOS); counts are scheduled once it moves.
    v.currentTime = Math.max(0, a - LEAD)
    v.playbackRate = 1
    v.muted = false
    void v.play().catch(() => {})
    setPreviewing(true)
    const ctx = audioContext()
    void loadVoices().then((clips) => {
      const schedule = () => {
        voices.current?.cancel()
        voices.current = playVoices(
          clips,
          counts.map((c) => ({ name: c.name, at: mediaToCtx(c.media, v.currentTime, ctx.currentTime, v.playbackRate) })),
        )
      }
      if (!v.paused && v.readyState >= 3) schedule()
      else v.addEventListener('playing', schedule, { once: true })
    })
  }

  /** Mark 1, then Mark 8: the video's time at the moment of the tap. */
  const mark = () => {
    const v = videoRef.current
    if (!v || phase !== 'marking') return
    const time = v.currentTime
    if (t1 == null) return setT1(time)
    setT8(time)
    v.pause()
    setPhase('preview')
    if (!marksProblem(t1, time)) preview(t1, time)
  }

  const redo = () => {
    stop()
    setT1(null)
    setT8(null)
    setPhase('ready')
  }

  useKeys({ ' ': () => (phase === 'ready' ? play() : phase === 'marking' ? mark() : preview()) })

  // The spoken count, big over the video, while previewing.
  const count = previewing && grid && t >= grid.offset - 0.05 ? position(t, grid) : null

  const hint =
    phase === 'ready'
      ? endedEarly
        ? 'The clip ended before both marks. Try again.'
        : 'Press play. Tap Mark 1 when count 1 hits, then Mark 8 when count 8 of the same bar hits.'
      : phase === 'marking'
        ? t1 == null
          ? 'Tap Mark 1 on count 1.'
          : 'Now tap Mark 8 on count 8.'
        : (problem ?? 'Listen: do the counts land on the beat?')

  return (
    <main className="first-beat" data-mode="learn">
      <div className="first-beat__video">
        <VideoStage
          src={src}
          mirror={dance.mirror}
          crop={dance.crop}
          videoSize={dance.videoSize}
          videoRef={videoRef}
        />
        {count && (
          <div className="set-counts__count">
            <BigCount count={count.count} beat={count.beatIndex} />
          </div>
        )}
        <header className="first-beat__top">
          <GlassButton icon="back" label="Back" onClick={onBack} />
          <span className="mk-body-strong mk-over-video">Set up</span>
          {step && <span className="first-beat__step mk-label-mono mk-over-video">{step}</span>}
        </header>
      </div>

      <section className="first-beat__sheet">
        <h1 className="mk-heading-m">{noBeat ? 'Couldn’t hear a beat. Mark your counts' : 'Mark your counts'}</h1>
        <p className="mk-body-small" aria-live="polite">
          {hint}
        </p>

        <div className="set-counts__marks mk-data-mono" aria-live="polite">
          <span data-set={t1 != null || undefined}>1 · {t1 == null ? '—' : `${t1.toFixed(2)}s`}</span>
          <span data-set={t8 != null || undefined}>8 · {t8 == null ? '—' : `${t8.toFixed(2)}s`}</span>
          {grid && <span className="set-counts__bpm">{Math.round(grid.bpm)} BPM</span>}
        </div>

        {phase === 'ready' && (
          <>
            <div className="set-counts__rate">
              <span className="mk-body-strong">Playback</span>
              <Segmented
                label="Playback speed while marking"
                value={rate}
                options={[
                  { value: '1', label: '1×' },
                  { value: '0.5', label: '0.5×' },
                ]}
                onChange={setRate}
              />
            </div>
            <Button className="set-counts__go" onClick={play}>
              <Icon name="play" size={20} />
              Play
            </Button>
          </>
        )}

        {phase === 'marking' && (
          <div className="first-beat__actions">
            <Button variant="secondary" onClick={redo}>
              Start over
            </Button>
            <Button className="set-counts__mark" onClick={mark}>
              {t1 == null ? 'Mark 1' : 'Mark 8'}
            </Button>
          </div>
        )}

        {phase === 'preview' && (
          <>
            <Button variant="secondary" className="set-counts__go" disabled={!grid} onClick={() => preview()}>
              <Icon name={previewing ? 'pause' : 'play'} size={20} />
              {previewing ? 'Stop' : 'Preview'}
            </Button>
            <div className="first-beat__actions">
              <Button variant="secondary" onClick={redo}>
                Redo
              </Button>
              <Button
                disabled={!grid}
                onClick={() => grid && onSave({ bpm: Math.round(grid.bpm * 100) / 100, offset: Math.round(grid.offset * 1000) / 1000 })}
              >
                Sounds right
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
