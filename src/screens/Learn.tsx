import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Ambient } from '../components/Ambient'
import { BigCount } from '../components/BigCount'
import { DeskTopBar, GlassButton, ModeCarousel, PlayShutter, RailButton, ShortcutsButton } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { useKeys } from '../hooks/useKeys'
import { useLayout } from '../hooks/useLayout'
import { usePlayhead } from '../hooks/usePlayhead'
import {
  barStart,
  beatTime,
  COUNTS_PER_BAR,
  loopTarget,
  position,
  stepBeat,
  type Grid,
  type Position,
} from '../lib/beat'
import { formatSpeed, SPEED_MAX, SPEED_MIN } from '../lib/speed'
import type { Dance, Sound } from '../types'
import './Learn.css'

const SPEED_TICKS = [0.25, 0.5, 0.75, 1, 1.25]

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['R', 'Restart'],
  ['← →', 'Step a beat'],
  ['[ ]', 'Prev / next bar'],
  ['L', 'Loop this bar'],
  ['M', 'Mirror'],
  ['F', 'Edit frame'],
  ['?', 'Show shortcuts'],
]

type Popover = 'speed' | 'sound' | 'keys' | null

type Props = {
  dance: Dance
  src: string
  onBack: () => void
  onEditFrame: () => void
  onRehearse: () => void
  onChange: (patch: Partial<Dance>) => void
}

export function Learn({ dance, src, onBack, onEditFrame, onRehearse, onChange }: Props) {
  const layout = useLayout()
  const videoRef = useRef<HTMLVideoElement>(null)
  const footerRef = useRef<HTMLElement>(null)
  const grid: Grid = useMemo(() => ({ bpm: dance.bpm, offset: dance.offset }), [dance.bpm, dance.offset])
  const [duration, setDuration] = useState(dance.duration)
  const [aspect, setAspect] = useState<number | null>(null)
  const [loopBar, setLoopBar] = useState<number | null>(null)
  const [popover, setPopover] = useState<Popover>(null)
  const [controlsH, setControlsH] = useState(0)

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

  // Phone portrait: the video gets everything above the controls, so the
  // dancer is never behind them. Measured, since the controls' height varies.
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
  const nextBar = () => goToBar(currentBar + 1)
  const step = (dir: 1 | -1) => {
    videoRef.current?.pause()
    const next = stepBeat(t, dir, grid, duration)
    if (loopBar != null) setLoopBar(position(next, grid).bar)
    seek(next)
  }
  const seekCount = (count: number) => seek(beatTime((currentBar - 1) * COUNTS_PER_BAR + count - 1, grid))
  const restart = () => seek(loopBar != null ? barStart(loopBar, grid) : 0)
  const toggleLoop = () => setLoopBar((b) => (b == null ? currentBar : null))
  const toggleMirror = () => onChange({ mirror: !dance.mirror })
  const setSpeed = (speed: number) => onChange({ lastSpeed: Math.round(speed * 100) / 100 })
  const setSound = (sound: Sound) => {
    onChange({ sound })
    setPopover(null)
  }
  const togglePopover = (p: Popover) => setPopover(popover === p ? null : p)

  useKeys({
    ' ': togglePlay,
    r: restart,
    ArrowLeft: () => step(-1),
    ArrowRight: () => step(1),
    '[': prevBar,
    ']': nextBar,
    l: toggleLoop,
    m: toggleMirror,
    f: onEditFrame,
    '?': () => togglePopover('keys'),
    Escape: () => setPopover(null),
  })

  const barProgress = (pos.count - 1 + pos.beatProgress) / COUNTS_PER_BAR
  const scrubber = <ScrubberTrack pos={pos} progress={barProgress} onCount={seekCount} />
  const speedPill = (
    <button
      type="button"
      className="speed-pill mk-glass"
      data-open={popover === 'speed' || undefined}
      aria-label={`Speed ${dance.lastSpeed}×`}
      aria-expanded={popover === 'speed'}
      onClick={() => togglePopover('speed')}
    >
      {formatSpeed(dance.lastSpeed)}
    </button>
  )
  const desktop = layout === 'desktop'
  const railIcon = layout === 'landscape' ? 16 : 28
  const count = <BigCount count={pos.count} beat={pos.beatIndex} />
  const popovers = (
    <>
      {(popover === 'speed' || popover === 'sound') && (
        <button type="button" className="popover-dismiss" aria-label="Close" onClick={() => setPopover(null)} />
      )}
      {popover === 'speed' && <SpeedPopover speed={dance.lastSpeed} onChange={setSpeed} />}
      {popover === 'sound' && <SoundPopover sound={dance.sound} onChange={setSound} />}
    </>
  )

  return (
    <div
      className={`learn${desktop ? ' desk' : ''}`}
      data-mode="learn"
      data-layout={layout}
      style={{ ...(aspect ? { '--ar': aspect } : {}), '--controls-h': `${controlsH}px` } as CSSProperties}
    >
      {/* The video stays at this position in every layout so resizing or
          rotating never remounts it (and never loses the playhead). */}
      <div className={desktop ? 'desk-frame' : 'learn__stage'}>
        <VideoStage
          src={src}
          mirror={dance.mirror}
          crop={dance.crop}
          fit="contain"
          videoRef={videoRef}
          onTap={togglePlay}
          onLoadedMetadata={(v) => {
            v.playbackRate = dance.lastSpeed
            setDuration(v.duration)
            setAspect((dance.crop.w * v.videoWidth) / (dance.crop.h * v.videoHeight))
          }}
        />
        {desktop && (
          <nav className="desk-frame__tools" aria-label="Tools">
            <GlassButton icon="sound" label="Sound" size={36} iconSize={18} className={popover === 'sound' ? 'is-open' : ''} aria-expanded={popover === 'sound'} onClick={() => togglePopover('sound')} />
            <GlassButton icon="mirror" label="Mirror" size={36} iconSize={18} className={dance.mirror ? 'is-on' : ''} aria-pressed={dance.mirror} onClick={toggleMirror} />
            <GlassButton icon="frame" label="Edit frame" size={36} iconSize={18} onClick={onEditFrame} />
          </nav>
        )}
      </div>

      {desktop ? (
        <>
          <Ambient videoRef={videoRef} />
          <DeskTopBar
            title={dance.name}
            meta={`${bars} bars · ${Math.round(dance.bpm)} BPM`}
            mode="learn"
            onBack={onBack}
            onMode={onRehearse}
            right={<ShortcutsButton keys={SHORTCUTS} open={popover === 'keys'} onToggle={() => togglePopover('keys')} />}
          />
          <div className="desk-count">{count}</div>
          {/* One row, ≤72px: bar position · transport · speed */}
          <footer className="desk-dock">
            <div className="desk-dock__wave">
              <GlassButton icon="back" label="Back one beat" size={36} iconSize={16} onClick={() => step(-1)} />
              <span className="mk-label-mono desk-dock__bar">Bar {currentBar}</span>
              {scrubber}
              <GlassButton icon="back" flip label="Forward one beat" size={36} iconSize={16} onClick={() => step(1)} />
            </div>
            <div className="desk-dock__transport">
              <GlassButton icon="restart" label="Restart" size={40} iconSize={18} onClick={restart} />
              <GlassButton icon="prev" label="Previous bar" size={40} iconSize={16} onClick={prevBar} />
              <PlayShutter playing={playing} onClick={togglePlay} />
              <GlassButton icon="next" label="Next bar" size={40} iconSize={16} onClick={nextBar} />
              <GlassButton
                icon="loop"
                label={loopBar != null ? 'Stop looping' : 'Loop this bar'}
                size={40}
                iconSize={18}
                className={loopBar != null ? 'is-on' : ''}
                aria-pressed={loopBar != null}
                onClick={toggleLoop}
              />
            </div>
            <div className="desk-dock__end">{speedPill}</div>
          </footer>
          {popovers}
        </>
      ) : (
        <>
          <div className="learn__scrim learn__scrim--top" />
          {layout === 'landscape' && <div className="learn__scrim learn__scrim--right" />}

          <div className="learn__ui">
            <header className="learn__top">
              <GlassButton icon="back" label="Back to library" size={layout === 'landscape' ? 34 : 40} onClick={onBack} />
              <ModeCarousel mode="learn" onChange={(m) => m === 'rehearse' && onRehearse()} />
              {/* Figma's ⋯ has no defined menu yet; a spacer keeps the mode
                  switch centred without shipping a button that does nothing. */}
              {layout === 'portrait' && <span className="learn__top-spacer" aria-hidden />}
            </header>

            <div className="learn__middle">
              {count}
              {/* Portrait: labelled rail on the right. Landscape: compact
                  icon row at the top right, camera-app style. */}
              <nav className="learn__rail" aria-label="Tools">
                <RailButton icon="sound" iconSize={railIcon} label="Sound" open={popover === 'sound'} onClick={() => togglePopover('sound')} />
                <RailButton icon="mirror" iconSize={railIcon} label="Mirror" on={dance.mirror} onClick={toggleMirror} />
                <RailButton icon="loop" iconSize={railIcon} label="Loop" on={loopBar != null} onClick={toggleLoop} />
                <RailButton icon="frame" iconSize={railIcon} label="Frame" onClick={onEditFrame} />
              </nav>
            </div>

            <footer ref={footerRef} className="learn__bottom">
              <div className="bars">
                <span className="bars__label mk-label-mono mk-over-video">Bars</span>
                <BarChips bars={bars} current={currentBar} looping={loopBar} onPick={goToBar} />
              </div>

              <div className="scrubber">
                <GlassButton icon="back" label="Back one beat" size={34} iconSize={16} onClick={() => step(-1)} />
                {scrubber}
                <GlassButton icon="back" flip label="Forward one beat" size={34} iconSize={16} onClick={() => step(1)} />
              </div>

              <div className="transport">
                <GlassButton icon="restart" label="Restart" onClick={restart} />
                <GlassButton icon="prev" label="Previous bar" onClick={prevBar} />
                <PlayShutter playing={playing} onClick={togglePlay} />
                <GlassButton icon="next" label="Next bar" onClick={nextBar} />
                {speedPill}
              </div>
            </footer>
          </div>
          {popovers}
        </>
      )}
    </div>
  )
}

function ScrubberTrack({ pos, progress, onCount }: { pos: Position; progress: number; onCount: (c: number) => void }) {
  return (
    <div className="scrubber__track">
      <div className="scrubber__counts mk-data-mono">
        {Array.from({ length: COUNTS_PER_BAR }, (_, i) => i + 1).map((c) => (
          <button
            key={c}
            type="button"
            className="scrubber__count"
            data-state={c < pos.count ? 'past' : c === pos.count ? 'now' : 'next'}
            aria-label={`Count ${c}`}
            onClick={() => onCount(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="scrubber__bar">
        <div className="scrubber__fill" style={{ width: `${progress * 100}%` }} />
      </div>
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

function SpeedSlider({ speed, onChange }: { speed: number; onChange: (s: number) => void }) {
  const pct = ((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100
  return (
    <input
      type="range"
      className="mk-slider"
      min={SPEED_MIN}
      max={SPEED_MAX}
      step={0.05}
      value={speed}
      style={{ '--fill': `${pct}%` } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Playback speed"
    />
  )
}

function SpeedPopover({ speed, onChange }: { speed: number; onChange: (s: number) => void }) {
  return (
    <div className="popover popover--speed" role="dialog" aria-label="Speed">
      <div className="popover__head mk-label-mono">
        <span>Speed</span>
        <span>Pitch kept</span>
      </div>
      <output className="popover__value mk-heading-xl">{speed.toFixed(2)}×</output>
      <SpeedSlider speed={speed} onChange={onChange} />
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
