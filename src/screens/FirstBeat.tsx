import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Button, GlassButton } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { Waveform } from '../components/Waveform'
import { usePlayhead } from '../hooks/usePlayhead'
import { decodeAudio } from '../lib/analyze'
import { barLen, beatLen, COUNTS_PER_BAR } from '../lib/beat'
import { beatsBetween, mediaToCtx } from '../lib/beatClock'
import { audioContext, unlockAudio } from '../lib/countIn'
import { snapOnset, windowPeaks } from '../lib/peaks'
import { loadVoices, playVoices, type Scheduled, type VoiceName } from '../lib/voice'
import type { Dance } from '../types'
import './FirstBeat.css'

const WINDOW = 8 // seconds of waveform on screen
const SNAP = 0.06 // snap a dropped marker to the nearest hit's onset within ±60 ms
const BUCKETS = 800

type Props = {
  dance: Dance
  src: string
  audio?: AudioBuffer // already decoded when coming from Getting it ready
  step?: string
  onBack: () => void
  onSave: (offset: number) => void
  /** The counts are wrong (not just the 1): set 1 and 8 by hand. */
  onFixCounts: (audio: AudioBuffer | undefined) => void
}

/** Setup · First beat: confirm (or move) where count 1 lands. */
export function FirstBeat({ dance, src, audio: given, step, onBack, onSave, onFixCounts }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const [audio, setAudio] = useState<AudioBuffer | null>(given ?? null)
  const [offset, setOffset] = useState(dance.offset)
  const [winStart, setWinStart] = useState(() => clampWin(dance.offset - 2, dance.duration))
  const [previewing, setPreviewing] = useState(false)
  const voices = useRef<Scheduled | null>(null)
  const dragging = useRef(false)

  const beat = beatLen(dance)
  const grid = { bpm: dance.bpm, offset }
  const winEnd = winStart + WINDOW

  // Clips opened from the library need their audio decoded again.
  useEffect(() => {
    if (audio) return
    let live = true
    decodeAudio(dance.video).then((a) => live && setAudio(a)).catch(console.error)
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
    setPreviewing(false)
  }, [])

  const { t } = usePlayhead(videoRef, (v) => {
    if (previewing && v.currentTime >= offset + barLen(dance) + beat * 0.5) stopPreview()
  })

  const moveTo = (next: number) => {
    stopPreview()
    const clamped = Math.max(0, Math.min(next, dance.duration - barLen(dance)))
    setOffset(clamped)
    if (clamped < winStart + 0.3 || clamped > winEnd - 0.3) setWinStart(clampWin(clamped - 2, dance.duration))
    const v = videoRef.current
    if (v) v.currentTime = clamped
  }

  // Seconds ↔ x within the waveform
  const timeAt = (clientX: number) => {
    const r = areaRef.current!.getBoundingClientRect()
    return winStart + ((clientX - r.left) / r.width) * WINDOW
  }
  const snap = (time: number) => (peaks ? snapOnset(peaks, winStart, WINDOW, time, SNAP) : time)

  // While the 1 is dragged, the video follows it so you can see the move
  // that lands there. One seek at a time: while the decoder is busy, keep
  // only the latest position and go there when the current seek lands.
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
    const time = Math.max(0, timeAt(e.clientX))
    setOffset(time)
    scrub(time)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return
    const time = Math.max(0, Math.min(timeAt(e.clientX), winEnd))
    setOffset(time)
    scrub(time)
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    moveTo(snap(timeAt(e.clientX)))
  }

  const preview = () => {
    if (previewing) return stopPreview()
    const v = videoRef.current
    if (!v) return
    unlockAudio()
    // play() stays inside the tap (iOS); counts are scheduled once it moves.
    v.currentTime = offset
    v.playbackRate = 1
    v.muted = false
    void v.play().catch(() => {})
    setPreviewing(true)
    const ctx = audioContext()
    void loadVoices().then((clips) => {
      const schedule = () => {
        const items = beatsBetween(grid, offset - 0.01, offset + barLen(dance) - 0.01).map((b) => ({
          name: String(b.count) as VoiceName,
          at: mediaToCtx(b.mediaTime, v.currentTime, ctx.currentTime, v.playbackRate),
        }))
        voices.current?.cancel()
        voices.current = playVoices(clips, items)
      }
      if (!v.paused && v.readyState >= 3) schedule()
      else v.addEventListener('playing', schedule, { once: true })
    })
  }

  useEffect(() => stopPreview, [stopPreview])

  const x = (time: number) => ((time - winStart) / WINDOW) * 100
  // Beat ticks across the window, numbered from the marker.
  const ticks: { time: number; count: number | null }[] = []
  for (let k = Math.ceil((winStart - offset) / beat); offset + k * beat < winEnd; k++) {
    ticks.push({ time: offset + k * beat, count: k >= 0 ? (k % COUNTS_PER_BAR) + 1 : null })
  }
  const showPlayhead = previewing && t >= winStart && t <= winEnd

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
            v.currentTime = offset
          }}
        />
        <header className="first-beat__top">
          <GlassButton icon="back" label="Back" iconSize={20} onClick={onBack} />
          <span className="mk-body-strong mk-over-video">Set up</span>
          {step && <span className="first-beat__step mk-label-mono mk-over-video">{step}</span>}
        </header>
      </div>

      <section className="first-beat__sheet">
        <h1 className="mk-heading-m">Is this where your first count starts?</h1>
        <p className="mk-body-small">Drag the 1 onto the first strong beat, then preview it with the counts.</p>

        <div
          ref={areaRef}
          className="beat-wave"
          role="slider"
          aria-label="First beat"
          aria-valuemin={0}
          aria-valuemax={Math.round(dance.duration * 100) / 100}
          aria-valuenow={Math.round(offset * 100) / 100}
          aria-valuetext={`Count 1 at ${offset.toFixed(2)} seconds`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') moveTo(offset - beat)
            if (e.key === 'ArrowRight') moveTo(offset + beat)
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {peaks ? <Waveform peaks={peaks} className="beat-wave__canvas" /> : <span className="beat-wave__loading mk-label-mono">Reading the audio…</span>}
          {ticks.map((tk) => (
            <span key={tk.time.toFixed(4)} className="beat-wave__tick" data-one={tk.count === 1 || undefined} style={{ left: `${x(tk.time)}%` }}>
              {tk.count != null && tk.count !== 1 && <span className="mk-label-mono">{tk.count}</span>}
            </span>
          ))}
          <span className="beat-wave__marker" style={{ left: `${x(offset)}%` }}>
            <span className="beat-wave__flag mk-label-mono">1</span>
          </span>
          {showPlayhead && <span className="beat-wave__playhead" style={{ left: `${x(t)}%` }} />}
        </div>

        <div className="first-beat__controls">
          <GlassButton icon="back" label="Move the 1 back one beat" size={44} iconSize={18} onClick={() => moveTo(offset - beat)} />
          <Button variant="secondary" className="first-beat__preview" onClick={preview}>
            <Icon name={previewing ? 'pause' : 'play'} size={18} />
            {previewing ? 'Stop' : 'Preview'}
          </Button>
          <GlassButton icon="back" flip label="Move the 1 forward one beat" size={44} iconSize={18} onClick={() => moveTo(offset + beat)} />
          <span className="first-beat__bpm mk-label-mono">{Math.round(dance.bpm)} BPM</span>
        </div>

        <div className="first-beat__actions">
          <Button variant="secondary" disabled={offset === dance.offset} onClick={() => moveTo(dance.offset)}>
            Reset
          </Button>
          <Button onClick={() => onSave(Math.round(offset * 1000) / 1000)}>Sounds right</Button>
        </div>
        <button
          type="button"
          className="first-beat__fix mk-body-small"
          onClick={() => {
            stopPreview()
            onFixCounts(audio ?? undefined)
          }}
        >
          Counts wrong? Set them yourself
        </button>
      </section>
    </main>
  )
}

function clampWin(start: number, duration: number) {
  return Math.max(0, Math.min(start, duration - WINDOW))
}
