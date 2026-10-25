import { useEffect, useMemo, useRef, useState } from 'react'
import { CountBadge, GlassButton, ModeCarousel, PlayShutter, RailButton } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { usePlayhead } from '../hooks/usePlayhead'
import { barStart, beatTime, COUNTS_PER_BAR, loopTarget, position, stepBeat, type Grid } from '../lib/beat'
import { formatSpeed, SPEED_MAX, SPEED_MIN } from '../lib/speed'
import type { Dance, Sound } from '../types'
import './Learn.css'

const SPEED_TICKS = [0.25, 0.5, 0.75, 1, 1.25]

type Popover = 'speed' | 'sound' | null

type Props = {
  dance: Dance
  src: string
  onBack: () => void
  onEditFrame: () => void
  onRehearse: () => void
  onChange: (patch: Partial<Dance>) => void
}

export function Learn({ dance, src, onBack, onEditFrame, onRehearse, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const grid: Grid = useMemo(() => ({ bpm: dance.bpm, offset: dance.offset }), [dance.bpm, dance.offset])
  const [duration, setDuration] = useState(dance.duration)
  const [loopBar, setLoopBar] = useState<number | null>(null)
  const [popover, setPopover] = useState<Popover>(null)

  const { t, playing } = usePlayhead(videoRef, (video) => {
    if (loopBar == null) return
    const target = loopTarget(video.currentTime, loopBar, grid)
    if (target != null) video.currentTime = target
  })

  const pos = position(t, grid)
  const bars = dance.bars
  const currentBar = Math.min(pos.bar, bars)

  useEffect(() => {
    const v = videoRef.current
    if (v) v.playbackRate = dance.lastSpeed
  }, [dance.lastSpeed])

  const seek = (time: number) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(time, duration))
  }
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }
  const goToBar = (bar: number) => {
    const b = Math.max(1, Math.min(bar, bars))
    if (loopBar != null) setLoopBar(b)
    seek(barStart(b, grid))
  }
  const prevBar = () => {
    // Like a music player: first press returns to the top of this bar.
    const intoBar = t - barStart(currentBar, grid)
    goToBar(intoBar > 60 / grid.bpm ? currentBar : currentBar - 1)
  }
  const step = (dir: 1 | -1) => {
    videoRef.current?.pause()
    const next = stepBeat(t, dir, grid, duration)
    if (loopBar != null) setLoopBar(position(next, grid).bar)
    seek(next)
  }
  const restart = () => seek(loopBar != null ? barStart(loopBar, grid) : 0)
  const toggleLoop = () => setLoopBar((b) => (b == null ? currentBar : null))
  const setSpeed = (speed: number) => onChange({ lastSpeed: Math.round(speed * 100) / 100 })
  const setSound = (sound: Sound) => {
    onChange({ sound })
    setPopover(null)
  }

  const showCounts = dance.sound !== 'music'
  const barProgress = (pos.count - 1 + pos.beatProgress) / COUNTS_PER_BAR

  return (
    <div className="learn" data-mode="learn">
      <VideoStage
        src={src}
        mirror={dance.mirror}
        crop={dance.crop}
        videoRef={videoRef}
        onLoadedMetadata={(v) => {
          v.playbackRate = dance.lastSpeed
          setDuration(v.duration)
        }}
      />
      <div className="learn__scrim learn__scrim--top" />
      <div className="learn__scrim learn__scrim--bottom" />

      <div className="learn__ui">
        <header className="learn__top">
          <GlassButton icon="back" label="Back to library" onClick={onBack} />
          <ModeCarousel mode="learn" onChange={(m) => m === 'rehearse' && onRehearse()} />
          <GlassButton icon="more" label="More" />
        </header>

        <div className="learn__middle">
          {showCounts && <CountBadge count={pos.count} sub={`of ${COUNTS_PER_BAR}`} />}

          <nav className="learn__rail" aria-label="Tools">
            <RailButton
              icon="sound"
              label="Sound"
              open={popover === 'sound'}
              onClick={() => setPopover(popover === 'sound' ? null : 'sound')}
            />
            <RailButton icon="mirror" label="Mirror" on={dance.mirror} onClick={() => onChange({ mirror: !dance.mirror })} />
            <RailButton icon="loop" label="Loop" on={loopBar != null} onClick={toggleLoop} />
            <RailButton icon="frame" label="Frame" onClick={onEditFrame} />
          </nav>
        </div>

        <footer className="learn__bottom">
          <div className="bars">
            <span className="bars__label mk-label-mono mk-over-video">Bars</span>
            <BarChips bars={bars} current={currentBar} looping={loopBar} onPick={goToBar} />
          </div>

          <div className="scrubber">
            <GlassButton icon="back" label="Back one beat" size={34} iconSize={16} onClick={() => step(-1)} />
            <div className="scrubber__track">
              <div className="scrubber__counts mk-data-mono">
                {Array.from({ length: COUNTS_PER_BAR }, (_, i) => i + 1).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="scrubber__count"
                    data-state={c < pos.count ? 'past' : c === pos.count ? 'now' : 'next'}
                    aria-label={`Count ${c}`}
                    onClick={() => seek(beatTime((currentBar - 1) * COUNTS_PER_BAR + c - 1, grid))}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="scrubber__bar">
                <div className="scrubber__fill" style={{ width: `${barProgress * 100}%` }} />
              </div>
            </div>
            <GlassButton icon="back" flip label="Forward one beat" size={34} iconSize={16} onClick={() => step(1)} />
          </div>

          <div className="transport">
            <GlassButton icon="restart" label="Restart" onClick={restart} />
            <GlassButton icon="prev" label="Previous bar" onClick={prevBar} />
            <PlayShutter playing={playing} onClick={togglePlay} />
            <GlassButton icon="next" label="Next bar" onClick={() => goToBar(currentBar + 1)} />
            <button
              type="button"
              className="speed-pill mk-glass"
              data-open={popover === 'speed' || undefined}
              aria-label={`Speed ${dance.lastSpeed}×`}
              aria-expanded={popover === 'speed'}
              onClick={() => setPopover(popover === 'speed' ? null : 'speed')}
            >
              {formatSpeed(dance.lastSpeed)}
            </button>
          </div>
        </footer>
      </div>

      {popover && <button type="button" className="popover-dismiss" aria-label="Close" onClick={() => setPopover(null)} />}
      {popover === 'speed' && <SpeedPopover speed={dance.lastSpeed} onChange={setSpeed} />}
      {popover === 'sound' && <SoundPopover sound={dance.sound} onChange={setSound} />}
    </div>
  )
}

function BarChips({
  bars,
  current,
  looping,
  onPick,
}: {
  bars: number
  current: number
  looping: number | null
  onPick: (bar: number) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const chip = rowRef.current?.querySelector<HTMLElement>(`[data-bar="${current}"]`)
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [current])

  return (
    <div ref={rowRef} className="bars__row">
      {Array.from({ length: bars }, (_, i) => i + 1).map((b) => (
        <button
          key={b}
          type="button"
          data-bar={b}
          className="bar-chip mk-glass mk-data-mono"
          data-active={b === current || undefined}
          data-looping={b === looping || undefined}
          aria-label={`Bar ${b}`}
          aria-current={b === current}
          onClick={() => onPick(b)}
        >
          {b}
        </button>
      ))}
    </div>
  )
}

function SpeedPopover({ speed, onChange }: { speed: number; onChange: (s: number) => void }) {
  const pct = ((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100
  return (
    <div className="popover popover--speed" role="dialog" aria-label="Speed">
      <div className="popover__head mk-label-mono">
        <span>Speed</span>
        <span>Pitch kept</span>
      </div>
      <output className="popover__value mk-heading-xl">{speed.toFixed(2)}×</output>
      <input
        type="range"
        className="mk-slider"
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={0.05}
        value={speed}
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Playback speed"
      />
      <div className="popover__ticks mk-label-mono">
        {SPEED_TICKS.map((s) => (
          <button key={s} type="button" data-active={s === speed || undefined} onClick={() => onChange(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

const SOUND_OPTIONS: { value: Sound; title: string; hint: string; disabled?: boolean }[] = [
  { value: 'music', title: 'Music', hint: 'Just the track' },
  { value: 'music+counts', title: 'Music + counts', hint: 'Count shown on screen' },
  { value: 'counts', title: 'Counts only', hint: 'Voice says 1–8, music off', disabled: true },
]

function SoundPopover({ sound, onChange }: { sound: Sound; onChange: (s: Sound) => void }) {
  return (
    <div className="popover popover--sound" role="dialog" aria-label="Sound">
      <div className="popover__head mk-label-mono">
        <span>Sound</span>
      </div>
      {SOUND_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={sound === o.value}
          className="sound-option"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          <span className="sound-option__radio">{sound === o.value && <Icon name="check" size={14} />}</span>
          <span className="sound-option__text">
            <span className="mk-body-strong">{o.title}</span>
            <span className="mk-body-small">{o.hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
