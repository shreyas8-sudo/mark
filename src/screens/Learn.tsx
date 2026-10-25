import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Ambient } from '../components/Ambient'
import { CountBadge, DeskTopBar, GlassButton, Kbd, ModeCarousel, PlayShutter, RailButton, Toggle } from '../components/controls'
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
import { formatTime } from '../lib/format'
import { formatSpeed, SPEED_MAX, SPEED_MIN } from '../lib/speed'
import type { Dance, Sound } from '../types'
import './Learn.css'

const SPEED_TICKS = [0.25, 0.5, 0.75, 1, 1.25]
const SPEED_CHIPS = [0.5, 0.75, 1]

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
  const layout = useLayout()
  const videoRef = useRef<HTMLVideoElement>(null)
  const grid: Grid = useMemo(() => ({ bpm: dance.bpm, offset: dance.offset }), [dance.bpm, dance.offset])
  const [duration, setDuration] = useState(dance.duration)
  const [aspect, setAspect] = useState<number | null>(null)
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
  const loopOn = (bar: number) => {
    setLoopBar(bar)
    seek(barStart(bar, grid))
  }
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
    Escape: () => setPopover(null),
  })

  const showCounts = dance.sound !== 'music'
  const barProgress = (pos.count - 1 + pos.beatProgress) / COUNTS_PER_BAR
  const badge = showCounts && <CountBadge count={pos.count} sub={`of ${COUNTS_PER_BAR}`} />
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

  return (
    <div
      className={`learn${desktop ? ' desk' : ''}`}
      data-mode="learn"
      data-layout={layout}
      style={aspect ? ({ '--ar': aspect } as CSSProperties) : undefined}
    >
      {/* The video stays at this position in every layout so resizing or
          rotating never remounts it (and never loses the playhead). */}
      <div className={desktop ? 'desk-frame' : 'learn__stage'}>
        <VideoStage
          src={src}
          mirror={dance.mirror}
          crop={dance.crop}
          videoRef={videoRef}
          onLoadedMetadata={(v) => {
            v.playbackRate = dance.lastSpeed
            setDuration(v.duration)
            setAspect((dance.crop.w * v.videoWidth) / (dance.crop.h * v.videoHeight))
          }}
        />
        {desktop && (
          <>
            <div className="desk-frame__badge">{badge}</div>
            {dance.mirror && (
              <span className="desk-frame__chip mk-glass mk-label-mono">
                <Icon name="mirror" size={14} /> Mirrored
              </span>
            )}
          </>
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
          />
          <BarsPanel bars={bars} grid={grid} current={currentBar} looping={loopBar} onPick={goToBar} onLoop={loopOn} />
          <ToolsPanel
            dance={dance}
            onSpeed={setSpeed}
            onSound={(sound) => onChange({ sound })}
            onMirror={toggleMirror}
            onEditFrame={onEditFrame}
          />
          <footer className="desk-dock">
            <div className="learn-dock__timeline">
              <span className="learn-dock__bar mk-label-mono">Bar {currentBar}</span>
              {scrubber}
              <span className="learn-dock__time mk-label-mono">
                {formatTime(t)} / {formatTime(duration)}
              </span>
            </div>
            <div className="desk-dock__row">
              <div className="learn-dock__step">
                <GlassButton icon="back" label="Back one beat" size={40} iconSize={18} onClick={() => step(-1)} />
                <span className="mk-label-mono">Step a beat</span>
                <GlassButton icon="back" flip label="Forward one beat" size={40} iconSize={18} onClick={() => step(1)} />
              </div>
              <div className="desk-dock__transport">
                <GlassButton icon="restart" label="Restart" size={48} iconSize={20} onClick={restart} />
                <GlassButton icon="prev" label="Previous bar" size={48} iconSize={18} onClick={prevBar} />
                <PlayShutter playing={playing} iconSize={26} onClick={togglePlay} />
                <GlassButton icon="next" label="Next bar" size={48} iconSize={18} onClick={nextBar} />
                <GlassButton
                  icon="loop"
                  label={loopBar != null ? 'Stop looping' : 'Loop this bar'}
                  size={48}
                  iconSize={20}
                  className={loopBar != null ? 'is-on' : ''}
                  aria-pressed={loopBar != null}
                  onClick={toggleLoop}
                />
              </div>
              <div className="learn-dock__hints mk-label-mono">
                <span>Space play</span>
                <span>← → beat</span>
                <span>[ ] bar</span>
                <span>L loop</span>
              </div>
            </div>
          </footer>
        </>
      ) : (
        <>
          <div className="learn__scrim learn__scrim--top" />
          <div className="learn__scrim learn__scrim--bottom" />
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
              {badge}
              {/* Portrait: labelled rail on the right. Landscape: compact
                  icon row at the top right, camera-app style. */}
              <nav className="learn__rail" aria-label="Tools">
                <RailButton icon="sound" iconSize={railIcon} label="Sound" open={popover === 'sound'} onClick={() => togglePopover('sound')} />
                <RailButton icon="mirror" iconSize={railIcon} label="Mirror" on={dance.mirror} onClick={toggleMirror} />
                <RailButton icon="loop" iconSize={railIcon} label="Loop" on={loopBar != null} onClick={toggleLoop} />
                <RailButton icon="frame" iconSize={railIcon} label="Frame" onClick={onEditFrame} />
              </nav>
            </div>

            <footer className="learn__bottom">
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

          {popover && <button type="button" className="popover-dismiss" aria-label="Close" onClick={() => setPopover(null)} />}
          {popover === 'speed' && <SpeedPopover speed={dance.lastSpeed} onChange={setSpeed} />}
          {popover === 'sound' && <SoundPopover sound={dance.sound} onChange={setSound} />}
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

/** Laptop: every bar with its start time. Click to jump, double-click to loop. */
function BarsPanel({
  bars,
  grid,
  current,
  looping,
  onPick,
  onLoop,
}: {
  bars: number
  grid: Grid
  current: number
  looping: number | null
  onPick: (bar: number) => void
  onLoop: (bar: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-bar="${current}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [current])

  return (
    <aside className="desk-panel desk-panel--left mk-glass bars-panel" aria-label="Bars">
      <span className="desk-panel__label mk-label-mono">Bars</span>
      <div ref={listRef} className="bars-panel__list">
        {Array.from({ length: bars }, (_, i) => i + 1).map((b) => (
          <button
            key={b}
            type="button"
            data-bar={b}
            className="bars-panel__row"
            data-active={b === current || undefined}
            aria-current={b === current}
            onClick={() => onPick(b)}
            onDoubleClick={() => onLoop(b)}
          >
            <span className="mk-data-mono">{String(b).padStart(2, '0')}</span>
            <span className="mk-body-small">
              {formatTime(barStart(b, grid))} · {COUNTS_PER_BAR} counts
            </span>
            {b === looping && <Icon name="loop" size={16} />}
          </button>
        ))}
      </div>
      <p className="bars-panel__hint mk-body-small">Click a bar to jump · double-click to loop</p>
    </aside>
  )
}

/** Laptop: speed, sound, mirror and frame, inline instead of popovers. */
function ToolsPanel({
  dance,
  onSpeed,
  onSound,
  onMirror,
  onEditFrame,
}: {
  dance: Dance
  onSpeed: (s: number) => void
  onSound: (s: Sound) => void
  onMirror: () => void
  onEditFrame: () => void
}) {
  const speed = dance.lastSpeed
  return (
    <aside className="desk-panel desk-panel--right mk-glass tools-panel" aria-label="Tools">
      <div className="tools-panel__speed">
        <div className="tools-panel__row">
          <span className="desk-panel__label mk-label-mono">Speed</span>
          <output className="tools-panel__value mk-heading-m">{speed.toFixed(2)}×</output>
        </div>
        <SpeedSlider speed={speed} onChange={onSpeed} />
        <div className="tools-panel__chips">
          {SPEED_CHIPS.map((s) => (
            <button key={s} type="button" className="tools-chip mk-data-mono" data-active={s === speed || undefined} onClick={() => onSpeed(s)}>
              {formatSpeed(s)}
            </button>
          ))}
        </div>
      </div>
      <hr />
      <div className="tools-panel__sound">
        <span className="desk-panel__label mk-label-mono">Sound</span>
        <div className="mk-segmented mk-segmented--glass" role="radiogroup" aria-label="Sound">
          {SOUND_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={dance.sound === o.value}
              className="mk-segmented__option mk-body-small"
              disabled={o.disabled}
              onClick={() => onSound(o.value)}
            >
              {o.short}
            </button>
          ))}
        </div>
      </div>
      <hr />
      <div className="tools-panel__row">
        <Icon name="mirror" size={20} />
        <span className="mk-body-strong">Mirror</span>
        <Kbd>M</Kbd>
        <Toggle label="Mirror" on={dance.mirror} onChange={onMirror} />
      </div>
      <button type="button" className="tools-panel__row" onClick={onEditFrame}>
        <Icon name="frame" size={20} />
        <span className="mk-body-strong">Edit frame</span>
        <Kbd>F</Kbd>
      </button>
    </aside>
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

const SOUND_OPTIONS: { value: Sound; title: string; short: string; hint: string; disabled?: boolean }[] = [
  { value: 'music', title: 'Music', short: 'Music', hint: 'Just the track' },
  { value: 'music+counts', title: 'Music + counts', short: '+ Counts', hint: 'Count shown on screen' },
  { value: 'counts', title: 'Counts only', short: 'Counts', hint: 'Voice says 1–8, music off', disabled: true },
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
