import { useEffect, useRef, useState } from 'react'
import { Button, GlassButton } from '../components/controls'
import { Icon } from '../components/Icon'
import { DEMO } from '../data/demo'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { useVideoRef } from '../hooks/useVideoRef'
import { analyze, type Analysis } from '../lib/analyze'
import { barCount } from '../lib/beat'
import { FULL_FRAME } from '../lib/crop'
import { captureFrame } from '../lib/thumb'
import type { Dance } from '../types'
import './Ready.css'

type StepState = 'pending' | 'active' | 'done' | 'manual'

type Props = {
  file: File
  onCancel: () => void
  /** `audio` is missing when the clip has no readable audio track. */
  onDone: (draft: Dance, audio: AudioBuffer | undefined, setCounts: boolean) => void
}

// Placeholder grid for a clip whose counts the dancer will set by hand.
const UNSET = { bpm: 120, offset: 0 }

/**
 * 02 Reading the beat: mirror, find the beat, split into bars — all
 * on-device. A clip is never turned away: with no beat found (or no audio
 * at all), the dancer sets the counts by hand next.
 */
export function Ready({ file, onCancel, onDone }: Props) {
  const src = useObjectUrl(file)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [duration, setDuration] = useState<number | null>(null) // from the video, if the audio won't decode
  const [result, setResult] = useState<Analysis | 'noAudio' | null>(null)
  const [split, setSplit] = useState(false)
  const [thumb, setThumb] = useState<Blob | null>(null)
  const started = useRef(false)
  const videoRef = useVideoRef(src)

  useEffect(() => {
    if (started.current) return
    started.current = true
    analyze(file)
      .then(setResult)
      .catch((err) => {
        console.error(err)
        setResult('noAudio')
      })
  }, [file])

  const analysis = result && result !== 'noAudio' ? result : null
  const found = analysis?.beat ?? null
  const noBeat = result === 'noAudio' || (!!analysis && !found)

  // Let "found the beat" land before "split into bars" so each step reads.
  useEffect(() => {
    if (!found) return
    const t = setTimeout(() => setSplit(true), 350)
    return () => clearTimeout(t)
  }, [found])

  const clipDuration = analysis?.duration ?? duration
  const bars = found && analysis ? barCount(analysis.duration, found) : 0
  // The preview's size is a nice-to-have: iOS may not load a video's
  // metadata before playback, so never let it hold up the flow.
  const ready = (!!found && split) || (noBeat && clipDuration != null)
  const mirrored = !!(size || result)

  const steps: { state: StepState; label: string }[] = [
    { state: mirrored ? 'done' : 'active', label: 'Mirrored' },
    {
      state: noBeat ? 'manual' : found ? 'done' : 'active',
      label: noBeat ? 'Couldn’t hear a beat' : found ? `Got the beat · ${Math.round(found.bpm)} BPM` : 'Finding the beat',
    },
    {
      state: split ? 'done' : found ? 'active' : 'pending',
      label: split ? `${bars} bars` : noBeat ? 'Bars follow from your counts' : 'Counting it out',
    },
  ]

  const finish = () => {
    if (!ready || clipDuration == null) return
    const grid = found ?? UNSET
    onDone({
      ...DEMO,
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, ''),
      createdAt: Date.now(),
      video: file,
      thumb: thumb ?? undefined,
      duration: clipDuration,
      bpm: grid.bpm,
      offset: grid.offset,
      peaks: analysis?.peaks,
      bars: barCount(clipDuration, grid),
      mirror: true,
      crop: FULL_FRAME,
      videoSize: size ?? undefined,
      orientation: size && size.w > size.h ? 'horizontal' : 'vertical',
      speed: 0.5,
    }, analysis?.audio, noBeat)
  }

  return (
    <main className="ready" data-mode="learn">
      <GlassButton icon="close" label="Cancel" solid onClick={onCancel} />

      <div className="ready__thumb">
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="metadata"
          // Seeking forces a decoded frame, so the thumbnail isn't black.
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            setSize({ w: v.videoWidth, h: v.videoHeight })
            if (Number.isFinite(v.duration)) setDuration(v.duration)
            v.currentTime = Math.min(1, v.duration / 2)
          }}
          onSeeked={(e) => {
            if (!thumb) void captureFrame(e.currentTarget).then(setThumb)
          }}
        />
      </div>

      <section className="ready__body">
        <h1 className="mk-heading-l">Reading the beat…</h1>
        <ul className="ready__steps">
          {steps.map((s) => (
            <li key={s.label} className="ready__step mk-body" data-state={s.state}>
              <span className="ready__mark">
                {s.state === 'done' && <Icon name="check" size={20} />}
              </span>
              {s.label}
            </li>
          ))}
        </ul>
        <p className="ready__note mk-body-small">
          {noBeat ? 'Couldn’t hear a clear beat. Mark your 1 and your 8, and we’ll count the rest.' : 'It all stays on your device.'}
        </p>
      </section>

      <Button className="ready__cta" disabled={!ready} onClick={finish}>
        {noBeat ? 'Mark your counts' : 'Check the 1'}
      </Button>
    </main>
  )
}
