import { useEffect, useRef, useState } from 'react'
import { Button, GlassButton } from '../components/controls'
import { Icon } from '../components/Icon'
import { DEMO } from '../data/demo'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { analyze, type Analysis } from '../lib/analyze'
import { barCount } from '../lib/beat'
import { FULL_FRAME } from '../lib/crop'
import { captureFrame } from '../lib/thumb'
import type { Dance } from '../types'
import './Ready.css'

type StepState = 'pending' | 'active' | 'done' | 'failed'

type Props = {
  file: File
  onCancel: () => void
  onDone: (draft: Dance, audio: AudioBuffer) => void
}

/** 02 Getting it ready: mirror, find the beat, split into bars — all on-device. */
export function Ready({ file, onCancel, onDone }: Props) {
  const src = useObjectUrl(file)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [result, setResult] = useState<Analysis | 'failed' | null>(null)
  const [split, setSplit] = useState(false)
  const [thumb, setThumb] = useState<Blob | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    analyze(file)
      .then(setResult)
      .catch((err) => {
        console.error(err)
        setResult('failed')
      })
  }, [file])

  // Let "found the beat" land before "split into bars" so each step reads.
  useEffect(() => {
    if (!result || result === 'failed') return
    const t = setTimeout(() => setSplit(true), 350)
    return () => clearTimeout(t)
  }, [result])

  const analysis = result && result !== 'failed' ? result : null
  const bars = analysis ? barCount(analysis.duration, analysis) : 0
  // The preview's size is a nice-to-have: iOS may not load a video's
  // metadata before playback, so never let it hold up the flow.
  const ready = !!(analysis && split)
  const mirrored = !!(size || result)

  const steps: { state: StepState; label: string }[] = [
    { state: mirrored ? 'done' : 'active', label: 'Mirrored' },
    {
      state: result === 'failed' ? 'failed' : analysis ? 'done' : 'active',
      label:
        result === 'failed'
          ? 'Couldn’t find a beat'
          : analysis
            ? `Found the beat · ${Math.round(analysis.bpm)} BPM`
            : 'Finding the beat',
    },
    {
      state: split ? 'done' : analysis ? 'active' : 'pending',
      label: split ? `Split into ${bars} bars` : 'Splitting into bars',
    },
  ]

  const finish = () => {
    if (!analysis) return
    onDone({
      ...DEMO,
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, ''),
      createdAt: Date.now(),
      video: file,
      thumb: thumb ?? undefined,
      duration: analysis.duration,
      bpm: analysis.bpm,
      offset: analysis.offset,
      peaks: analysis.peaks,
      bars,
      mirror: true,
      crop: FULL_FRAME,
      orientation: size && size.w > size.h ? 'horizontal' : 'vertical',
      lastSpeed: 1,
    }, analysis.audio)
  }

  return (
    <main className="ready" data-mode="learn">
      <GlassButton icon="close" label="Cancel" iconSize={20} onClick={onCancel} />

      <div className="ready__thumb">
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          // Seeking forces a decoded frame, so the thumbnail isn't black.
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            setSize({ w: v.videoWidth, h: v.videoHeight })
            v.currentTime = Math.min(1, v.duration / 2)
          }}
          onSeeked={(e) => {
            if (!thumb) void captureFrame(e.currentTarget).then(setThumb)
          }}
        />
      </div>

      <section className="ready__body">
        <h1 className="mk-heading-l">Getting it ready</h1>
        <ul className="ready__steps">
          {steps.map((s) => (
            <li key={s.label} className="ready__step mk-body" data-state={s.state}>
              <span className="ready__mark">
                {s.state === 'done' && <Icon name="check" size={16} />}
                {s.state === 'failed' && <Icon name="close" size={16} />}
              </span>
              {s.label}
            </li>
          ))}
        </ul>
        <p className="ready__note mk-body-small">
          {result === 'failed'
            ? 'Mark needs a clear beat to count. Try a clip where the music is loud and steady.'
            : 'Everything stays on your device.'}
        </p>
      </section>

      {result === 'failed' ? (
        <Button className="ready__cta" onClick={onCancel}>
          Choose another video
        </Button>
      ) : (
        <Button className="ready__cta" disabled={!ready} onClick={finish}>
          Check the first beat
        </Button>
      )}
    </main>
  )
}
