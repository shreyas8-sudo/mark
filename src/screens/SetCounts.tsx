import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Button, GlassButton, Segmented } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { Waveform } from '../components/Waveform'
import { usePlayhead } from '../hooks/usePlayhead'
import { decodeAudio } from '../lib/analyze'
import { COUNTS_PER_BAR, type Grid } from '../lib/beat'
import { mediaToCtx } from '../lib/beatClock'
import { gridFromMarks, marksProblem } from '../lib/counts'
import { audioContext, unlockAudio } from '../lib/countIn'
import { snapOnset, windowPeaks } from '../lib/peaks'
import { loadVoices, playVoices, type Scheduled, type VoiceName } from '../lib/voice'
import type { Dance } from '../types'
import './FirstBeat.css'

const WINDOW = 10 // seconds of waveform on screen: room for 1→8 down to ~45 BPM
const BUCKETS = 1000
const LEAD = 1 // seconds of video before the first previewed count

type Mark = 1 | 8

type Props = {
  dance: Dance
  src: string
  audio?: AudioBuffer // already decoded when coming from Reading the beat
  /** Beat detection failed, rather than the dancer asking to fix the counts. */
  noBeat?: boolean
  step?: string
  onBack: () => void
  onSave: (grid: Grid) => void
}

/**
 * Setup · Set your counts: the dancer marks count 1 and count 8 of one bar
 * on the waveform, previewing each; tempo and bars follow from those two.
 * Used when beat detection fails, and from "Redo counts".
 */
export function SetCounts({ dance, src, audio: given, noBeat, step, onBack, onSave }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const [audio, setAudio] = useState<AudioBuffer | null>(given ?? null)
  const [noAudio, setNoAudio] = useState(false)
  // Fixing counts starts from the current grid; a failed detection from nothing.
  const [t1, setT1] = useState<number | null>(noBeat ? null : dance.offset)
  const [t8, setT8] = useState<number | null>(noBeat ? null : dance.offset + (7 * 60) / dance.bpm)
  const [active, setActive] = useState<Mark>(1)
  const [winStart, setWinStart] = useState(() => clampWin((noBeat ? 0 : dance.offset) - 1, dance.duration))
  const [previewing, setPreviewing] = useState<{ mark: Mark; until: number } | null>(null)
  const voices = useRef<Scheduled | null>(null)
  const dragging = useRef(false)

  const problem = marksProblem(t1, t8)
  const grid = t1 != null && t8 != null && !problem ? gridFromMarks(t1, t8) : null
  const beat = grid ? 60 / grid.bpm : null
  const winEnd = winStart + WINDOW

  // Clips opened from the library need their audio decoded again. No audio
  // track at all still works: mark the counts by watching the video.
  useEffect(() => {
    if (audio) return
    let live = true
    decodeAudio(dance.video)
      .then((a) => live && setAudio(a))
      .catch((err) => {
        console.error(err)
        if (live) setNoAudio(true)
      })
    return () => {
      live = false
    }
  }, [audio, dance.video])

  useEffect(() => {
    void loadVoices() // warm up so Preview starts instantly
  }, [])

  const peaks = useMemo(
    () => (audio ? windowPeaks(audio.getChannelData(0), audio.sampleRate, winStart, winStart + WINDOW, BUCKETS) : null),
    [audio, winStart],
  )

  const stopPreview = useCallback(() => {
    voices.current?.cancel()
    voices.current = null
    videoRef.current?.pause()
    setPreviewing(null)
  }, [])
  useEffect(() => stopPreview, [stopPreview])

  const { t } = usePlayhead(videoRef, (v) => {
    if (previewing && v.currentTime >= previewing.until) stopPreview()
  })

  const setMark = (mark: Mark, time: number) => (mark === 1 ? setT1(time) : setT8(time))
  const clampTime = (time: number) => Math.max(0, Math.min(time, dance.duration))

  // Seconds ↔ x within the waveform
  const timeAt = (clientX: number) => {
    const r = areaRef.current!.getBoundingClientRect()
    return clampTime(winStart + ((clientX - r.left) / r.width) * WINDOW)
  }

  // While a mark is dragged the video follows it, one seek at a time.
  const scrubTo = useRef<number | null>(null)
  const scrub = (time: number) => {
    const v = videoRef.current
    if (!v) return
    if (v.seeking) {
      scrubTo.current = time
      return
    }
    v.currentTime = time
    v.addEventListener(
      'seeked',
      () => {
        const next = scrubTo.current
        scrubTo.current = null
        if (next != null) scrub(next)
      },
      { once: true },
    )
  }

  const onPointerDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    stopPreview()
    const time = timeAt(e.clientX)
    setMark(active, time)
    scrub(time)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return
    const time = timeAt(e.clientX)
    setMark(active, time)
    scrub(time)
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    const time = peaks ? snapOnset(peaks, winStart, WINDOW, timeAt(e.clientX)) : timeAt(e.clientX)
    setMark(active, time)
    scrub(time)
    // Placing the 1 for the first time moves straight on to the 8.
    if (active === 1 && t8 == null) setActive(8)
  }

  const nudge = (dir: 1 | -1) => {
    const current = active === 1 ? t1 : t8
    if (current == null) return
    const time = clampTime(current + dir * 0.02)
    setMark(active, time)
    scrub(time)
  }

  /**
   * Play the video around one mark with its counts spoken: 1-2-3-4 from
   * count 1, or 5-6-7-8 into count 8. Before both marks make a tempo, just
   * the mark's own number.
   */
  const preview = (mark: Mark) => {
    if (previewing?.mark === mark) return stopPreview()
    const at = mark === 1 ? t1 : t8
    const v = videoRef.current
    if (at == null || !v) return
    stopPreview()
    const counts: { name: VoiceName; media: number }[] =
      beat == null ? [{ name: String(mark) as VoiceName, media: at }]
      : mark === 1 ? [1, 2, 3, 4].map((n) => ({ name: String(n) as VoiceName, media: at + (n - 1) * beat }))
      : [5, 6, 7, 8].map((n) => ({ name: String(n) as VoiceName, media: at - (COUNTS_PER_BAR - n) * beat }))
    const from = Math.max(0, counts[0].media - LEAD)
    const until = Math.min(dance.duration, counts[counts.length - 1].media + (beat ?? 0.5) * 0.9)

    unlockAudio()
    // play() stays inside the tap (iOS); counts are scheduled once it moves.
    v.currentTime = from
    v.playbackRate = 1
    v.muted = false
    void v.play().catch(() => {})
    setPreviewing({ mark, until })
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

  const x = (time: number) => ((time - winStart) / WINDOW) * 100
  const inWindow = (time: number | null): time is number => time != null && time >= winStart && time <= winEnd
  const ticks = grid && t1 != null ? Array.from({ length: 6 }, (_, i) => ({ n: i + 2, time: t1 + (i + 1) * (beat as number) })) : []
  const showPlayhead = previewing && t >= winStart && t <= winEnd
  const markTime = active === 1 ? t1 : t8

  const pan = (dir: 1 | -1) => setWinStart((w) => clampWin(w + (dir * WINDOW) / 2, dance.duration))

  return (
    <main className="first-beat" data-mode="learn">
      <div className="first-beat__video">
        <VideoStage
          src={src}
          mirror={dance.mirror}
          crop={dance.crop}
          videoSize={dance.videoSize}
          videoRef={videoRef}
          onLoadedMetadata={(v) => {
            v.currentTime = t1 ?? 0
          }}
        />
        <header className="first-beat__top">
          <GlassButton icon="back" label="Back" onClick={onBack} />
          <span className="mk-body-strong mk-over-video">Set up</span>
          {step && <span className="first-beat__step mk-label mk-over-video">{step}</span>}
        </header>
      </div>

      <section className="first-beat__sheet">
        <h1 className="mk-heading-m">{noBeat ? 'Couldn’t hear a beat. Mark your counts' : 'Mark your counts'}</h1>
        <p className="mk-body-small">
          Mark where count 1 lands, then count 8 of the same bar. Preview each to hear it on the beat.
        </p>

        <Segmented
          label="Which count to mark"
          value={String(active) as '1' | '8'}
          options={[
            { value: '1', label: t1 == null ? 'Count 1' : `Count 1 · ${t1.toFixed(2)}s` },
            { value: '8', label: t8 == null ? 'Count 8' : `Count 8 · ${t8.toFixed(2)}s` },
          ]}
          onChange={(v) => setActive(Number(v) as Mark)}
        />

        <div className="set-counts__wave-row">
          <GlassButton icon="back" label="Earlier in the song" size={36} disabled={winStart <= 0} onClick={() => pan(-1)} />
          <div
            ref={areaRef}
            className="beat-wave set-counts__wave"
            role="slider"
            aria-label={`Count ${active}`}
            aria-valuemin={0}
            aria-valuemax={Math.round(dance.duration * 100) / 100}
            aria-valuenow={markTime == null ? undefined : Math.round(markTime * 100) / 100}
            aria-valuetext={markTime == null ? 'Not marked' : `Count ${active} at ${markTime.toFixed(2)} seconds`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') nudge(-1)
              if (e.key === 'ArrowRight') nudge(1)
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {peaks ? (
              <Waveform peaks={peaks} className="beat-wave__canvas" />
            ) : (
              <span className="beat-wave__loading mk-label">{noAudio ? 'No sound. Mark it from the video' : 'Listening…'}</span>
            )}
            {ticks.filter((tk) => inWindow(tk.time)).map((tk) => (
              <span key={tk.n} className="beat-wave__tick" style={{ left: `${x(tk.time)}%` }}>
                <span className="mk-label-mono">{tk.n}</span>
              </span>
            ))}
            {([1, 8] as const).map((m) => {
              const time = m === 1 ? t1 : t8
              return (
                inWindow(time) && (
                  <span key={m} className="beat-wave__marker" data-inactive={m !== active || undefined} style={{ left: `${x(time)}%` }}>
                    <span className="beat-wave__flag mk-label-mono">{m}</span>
                  </span>
                )
              )
            })}
            {showPlayhead && <span className="beat-wave__playhead" style={{ left: `${x(t)}%` }} />}
          </div>
          <GlassButton icon="back" flip label="Later in the song" size={36} disabled={winEnd >= dance.duration} onClick={() => pan(1)} />
        </div>

        <div className="first-beat__controls">
          {([1, 8] as const).map((m) => (
            <Button
              key={m}
              variant="secondary"
              className="first-beat__preview"
              disabled={(m === 1 ? t1 : t8) == null}
              onClick={() => preview(m)}
            >
              <Icon name={previewing?.mark === m ? 'pause' : 'play'} size={20} />
              {previewing?.mark === m ? 'Stop' : `Play ${m}`}
            </Button>
          ))}
          <span className="first-beat__bpm mk-label-mono" aria-live="polite">
            {grid ? `${Math.round(grid.bpm)} BPM` : problem}
          </span>
        </div>

        <div className="first-beat__actions">
          <Button
            variant="secondary"
            disabled={t1 == null && t8 == null}
            onClick={() => {
              stopPreview()
              setT1(null)
              setT8(null)
              setActive(1)
            }}
          >
            Clear
          </Button>
          <Button disabled={!grid} onClick={() => grid && onSave({ bpm: Math.round(grid.bpm * 100) / 100, offset: Math.round(grid.offset * 1000) / 1000 })}>
            Lock it in
          </Button>
        </div>
      </section>
    </main>
  )
}

function clampWin(start: number, duration: number) {
  return Math.max(0, Math.min(start, duration - WINDOW))
}
