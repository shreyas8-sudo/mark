import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Ambient } from '../components/Ambient'
import { BarStrip } from '../components/BarStrip'
import { BigCount } from '../components/BigCount'
import { CoachMarks, type CoachMark } from '../components/CoachMarks'
import { Button, DeskTopBar, GlassButton, ModeCarousel, PlayShutter, ShortcutsButton } from '../components/controls'
import { Icon } from '../components/Icon'
import { AnchoredPopover, ToolRow, type Tool } from '../components/Tools'
import { VideoStage } from '../components/VideoStage'
import { useKeys } from '../hooks/useKeys'
import { useLayout } from '../hooks/useLayout'
import { usePeaks } from '../hooks/usePeaks'
import { usePlayhead } from '../hooks/usePlayhead'
import { useVoiceCounts } from '../hooks/useVoiceCounts'
import { barEnd, barStart, beatLen, loopTarget, position, stepBeat, type Grid } from '../lib/beat'
import { coachMarksDone } from '../lib/coachMarks'
import { countIn as playCountIn, unlockAudio } from '../lib/countIn'
import { followLearned, lastLearned, markLearned, nextSpeed, NUDGE_AFTER_LOOPS, SLOW_SPEED, unmarkLearned } from '../lib/learn'
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
  ['C', 'Count-in on / off'],
  ['Enter', 'Got it'],
  ['F', 'Edit frame'],
  ['?', 'Show shortcuts'],
]

type Popover = { name: 'speed' | 'sound'; anchor: HTMLElement } | { name: 'keys' } | null

// First visit to Learn only.
const COACH_MARKS: CoachMark[] = [
  { target: 'strip', text: 'Tap a bar to jump to it' },
  { target: 'speed', text: 'Start slow and bump the speed when it clicks' },
  {
    target: 'got-it',
    text: (
      <>
        Tap <Icon name="check" size={20} /> when you’ve got a bar
      </>
    ),
  },
]

type Props = {
  dance: Dance
  src: string
  onBack: () => void
  onEditFrame: () => void
  /** Switch to Rehearse (optionally after setting its bar range). */
  onRehearse: () => void
  onChange: (patch: Partial<Dance>) => void
  /** Waveform peaks computed for a clip saved before v2, to be stored. */
  onPeaks?: (peaks: Float32Array) => void
}

export function Learn({ dance, src, onBack, onEditFrame, onRehearse, onChange, onPeaks }: Props) {
  const layout = useLayout()
  const videoRef = useRef<HTMLVideoElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const grid: Grid = useMemo(() => ({ bpm: dance.bpm, offset: dance.offset }), [dance.bpm, dance.offset])
  const [duration, setDuration] = useState(dance.duration)
  const [videoSize, setVideoSize] = useState(dance.videoSize)
  const aspect = videoSize ? (dance.crop.w * videoSize.w) / (dance.crop.h * videoSize.h) : null
  // Guided: open on the bar being learned, looping it.
  const [loopBar, setLoopBar] = useState<number | null>(() => Math.min(Math.max(1, dance.currentBar), dance.bars))
  const [runEnd, setRunEnd] = useState<number | null>(null) // "Run 1–N together"
  const [sheet, setSheet] = useState<{ bar: number; learned: number[] } | null>(null)
  const [coaching, setCoaching] = useState(() => !coachMarksDone('learn'))
  // Speed-up nudge after a few laps of the same bar at the same speed.
  const laps = useRef({ key: '', count: 0 })
  const nudged = useRef(new Set<string>())
  const [nudge, setNudge] = useState<number | null>(null)
  const [popover, setPopover] = useState<Popover>(null)
  const [controlsH, setControlsH] = useState(0)
  const [countingIn, setCountingIn] = useState<number | null>(null) // 5–8 on screen
  const cancelCountIn = useRef<(() => void) | null>(null)
  const peaks = usePeaks(dance, onPeaks)

  // Per-frame work (run-through end, bar loop) is defined
  // further down, once the handlers it calls exist.
  const onFrame = useRef<(video: HTMLVideoElement) => void>(() => {})
  const { t, playing } = usePlayhead(videoRef, (video) => onFrame.current(video))


  const pos = position(t, grid)
  const bars = dance.bars
  const currentBar = Math.min(pos.bar, bars)

  useEffect(() => {
    const v = videoRef.current
    if (v) v.playbackRate = dance.speed
  }, [dance.speed])

  // Voice counts mutes the track; the other modes play it.
  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = dance.sound === 'voice'
  }, [dance.sound])

  useVoiceCounts(videoRef, {
    enabled: dance.sound !== 'music',
    grid,
    volume: dance.sound === 'voice' ? 1 : 0.7,
    stopAt: runEnd != null ? barEnd(runEnd, grid) : loopBar != null ? barEnd(loopBar, grid) : null,
  })

  // Remember where guided Learn resumes.
  const { currentBar: savedBar } = dance
  useEffect(() => {
    if (loopBar != null && loopBar !== savedBar) onChange({ currentBar: loopBar })
  }, [loopBar, savedBar, onChange])

  useEffect(() => () => cancelCountIn.current?.(), [])

  // Phone (portrait and landscape): the video gets everything above the bar
  // strip, so the strip never covers the dancer's feet; the transport floats
  // over the video. Measured, since the strip's height varies.
  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el || layout === 'desktop') return setControlsH(0)
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
  const stopCountIn = () => {
    cancelCountIn.current?.()
    cancelCountIn.current = null
    setCountingIn(null)
  }
  // ---- Speed-up nudge (never changes speed by itself) ----
  function countLap(bar: number) {
    const key = `${bar}@${dance.speed}`
    laps.current = laps.current.key === key ? { key, count: laps.current.count + 1 } : { key, count: 1 }
    const next = nextSpeed(dance.speed)
    if (laps.current.count >= NUDGE_AFTER_LOOPS && next && !nudged.current.has(key)) {
      nudged.current.add(key)
      setNudge(next)
    }
  }
  useEffect(() => {
    if (nudge == null) return
    const id = window.setTimeout(() => setNudge(null), 8000)
    return () => clearTimeout(id)
  }, [nudge])

  useEffect(() => {
    onFrame.current = (video) => {
      if (runEnd != null) {
        // Run-through finished: stop and bring the sheet back.
        if (video.currentTime >= barEnd(runEnd, grid)) {
          video.pause()
          video.currentTime = barEnd(runEnd, grid) - 0.02 // rest on bar N, not a frame into N+1
          setRunEnd(null)
          setSheet({ bar: runEnd, learned: dance.learned })
        }
        return
      }
      if (loopBar == null) return
      const target = loopTarget(video.currentTime, loopBar, grid)
      if (target == null) return
      if (video.currentTime >= barEnd(loopBar, grid)) countLap(loopBar) // a wrap, not a jump in
      video.currentTime = target
    }
  })

  /** Play from `from` (with the 5-6-7-8 if count-in is on). Call from a tap. */
  const startFrom = (from: number, speed = dance.speed) => {
    const v = videoRef.current
    if (!v) return
    stopCountIn()
    v.playbackRate = speed
    if (!dance.countIn) {
      v.currentTime = from
      return void v.play().catch(() => {})
    }
    // play() + pause() inside the tap lets iOS start it from the timer later.
    unlockAudio()
    v.play().catch(() => {})
    v.pause()
    v.currentTime = from
    cancelCountIn.current = playCountIn(beatLen(grid) / speed, setCountingIn, () => {
      cancelCountIn.current = null
      setCountingIn(null)
      void v.play().catch(() => {})
    })
  }
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (cancelCountIn.current) return stopCountIn() // tap during 5-6-7-8 cancels it
    if (!v.paused) return v.pause()
    if (!dance.countIn) return void v.play().catch(() => {})
    startFrom(barStart(loopBar ?? currentBar, grid)) // count in from the top of the bar
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
  const restart = () => seek(loopBar != null ? barStart(loopBar, grid) : 0)
  const toggleLoop = () => setLoopBar((b) => (b == null ? currentBar : null))
  const loopBarAt = (bar: number) => {
    setLoopBar(bar)
    seek(barStart(bar, grid))
  }
  // ---- Guided learning ----
  const gotIt = () => {
    const bar = loopBar ?? currentBar
    const learned = markLearned(dance.learned, bar)
    onChange({ learned, run: followLearned(dance.run, dance.learned, learned) })
    stopCountIn()
    videoRef.current?.pause()
    setSheet({ bar, learned })
  }
  const unlearn = (bar: number) => {
    const learned = unmarkLearned(dance.learned, bar)
    onChange({ learned, run: followLearned(dance.run, dance.learned, learned) })
  }
  const learnNextBar = (bar: number) => {
    const next = Math.min(bar + 1, bars)
    setSheet(null)
    setRunEnd(null)
    setLoopBar(next)
    onChange({ speed: SLOW_SPEED, currentBar: next })
    startFrom(barStart(next, grid), SLOW_SPEED)
  }
  const runTogether = (learned: number[]) => {
    setSheet(null)
    setLoopBar(null)
    setRunEnd(lastLearned(learned))
    startFrom(barStart(1, grid))
  }
  const rehearseLearned = (learned: number[]) => {
    onChange({ run: { ...dance.run, barStart: 1, barEnd: lastLearned(learned) } })
    onRehearse()
  }

  const toggleMirror = () => onChange({ mirror: !dance.mirror })
  const toggleCountIn = () => onChange({ countIn: !dance.countIn })
  const setSpeed = (speed: number) => onChange({ speed: Math.round(speed * 100) / 100 })
  const setSound = (sound: Sound) => {
    onChange({ sound })
    setPopover(null)
  }
  const openAt = (name: 'speed' | 'sound', anchor: HTMLElement) =>
    setPopover(popover?.name === name ? null : { name, anchor })
  const toggleKeys = () => setPopover(popover?.name === 'keys' ? null : { name: 'keys' })

  useKeys({
    ' ': togglePlay,
    r: restart,
    ArrowLeft: () => step(-1),
    ArrowRight: () => step(1),
    '[': prevBar,
    ']': nextBar,
    l: toggleLoop,
    m: toggleMirror,
    c: toggleCountIn,
    f: onEditFrame,
    Enter: gotIt,
    '?': toggleKeys,
    Escape: () => {
      setPopover(null)
      setSheet(null)
    },
  })

  const strip = (labels: 'current' | 'all', chunkWidth?: number) => (
    <BarStrip
      peaks={peaks}
      duration={duration}
      grid={grid}
      bars={bars}
      current={currentBar}
      t={t}
      looping={loopBar}
      learned={dance.learned}
      labels={labels}
      chunkWidth={chunkWidth}
      onPick={goToBar}
      onLoop={loopBarAt}
      onUnlearn={unlearn}
    />
  )
  const desktop = layout === 'desktop'
  // Regular counts sit at the side; the 5-6-7-8 count-in takes the centre
  // of the video, big.
  const count = <BigCount count={countingIn != null ? null : pos.count} beat={pos.beatIndex} />
  const countInOverlay = countingIn != null && (
    <div className="count-in-centre">
      <BigCount count={countingIn} beat={countingIn} countIn />
    </div>
  )
  const nudgeToast = nudge != null && (
    <div className="nudge mk-glass" role="status">
      <span className="mk-body-strong">Got the feel? Bump it up</span>
      <button
        type="button"
        className="nudge__try mk-body-strong"
        onClick={() => {
          setSpeed(nudge)
          setNudge(null)
        }}
      >
        {formatSpeed(nudge)}
      </button>
      <button type="button" className="nudge__close" aria-label="Dismiss" onClick={() => setNudge(null)}>
        <Icon name="close" size={20} />
      </button>
    </div>
  )
  // Laptop with a vertical clip: the controls sit beside the video on the
  // plain background, so they're solid. Over video they're glass.
  const wide = aspect != null && aspect > 1
  const solid = desktop && !wide
  // Speed sits apart (bottom left of the video), so the column holds the rest.
  const tools: Tool[] = [
    { id: 'sound', label: 'Sound', icon: 'sound', open: popover?.name === 'sound', onClick: (b) => openAt('sound', b) },
    { id: 'mirror', label: 'Mirror', icon: 'mirror', on: dance.mirror, onClick: toggleMirror },
    { id: 'count-in', label: 'Count-in', glyph: '5678', on: dance.countIn, onClick: toggleCountIn },
    { id: 'frame', label: 'Edit frame', icon: 'frame', onClick: onEditFrame },
  ]
  const toolSize = layout === 'landscape' ? 34 : desktop ? 44 : 40
  const toolColumn = <ToolRow tools={tools} size={toolSize} solid={solid} vertical />
  const speedButton = (
    <GlassButton
      glyph={formatSpeed(dance.speed)}
      label={`Speed ${formatSpeed(dance.speed)}`}
      title="Speed"
      size={toolSize}
      solid={solid}
      className={`tool-btn speed-btn${popover?.name === 'speed' ? ' is-open' : ''}`}
      aria-expanded={popover?.name === 'speed'}
      data-coach="speed"
      onClick={(e) => openAt('speed', e.currentTarget)}
    />
  )
  // One long bar over the bottom of the video, on every layout.
  const barBtn = layout === 'landscape' ? 34 : desktop ? 40 : 36
  const transportBar = (
    <div className="transport-bar mk-glass">
      <GlassButton icon="restart" label="Restart" size={barBtn} onClick={restart} />
      <GlassButton icon="prev" label="Previous bar" size={barBtn} onClick={prevBar} />
      <PlayShutter playing={playing} onClick={togglePlay} />
      <GlassButton icon="next" label="Next bar" size={barBtn} onClick={nextBar} />
      <GlassButton
        icon="loop"
        size={barBtn}
        label={loopBar != null ? 'Stop looping' : 'Loop this bar'}
        className={loopBar != null ? 'is-on' : ''}
        aria-pressed={loopBar != null}
        onClick={toggleLoop}
      />
    </div>
  )
  const thisBarLearned = dance.learned.includes(loopBar ?? currentBar)
  const gotItButton = desktop ? (
    <Button className={`got-it-pill${thisBarLearned ? ' is-learned' : ''}`} data-coach="got-it" onClick={gotIt}>
      <Icon name="check" size={20} /> Got it
    </Button>
  ) : (
    <GlassButton
      icon="check"
      label="Got it"
      size={toolSize}
      className={`got-it${thisBarLearned ? ' is-learned' : ''}`}
      data-coach="got-it"
      onClick={gotIt}
    />
  )
  const gotItSheet = sheet && (
    <GotItSheet
      bar={sheet.bar}
      learned={sheet.learned}
      bars={bars}
      onNext={() => learnNextBar(sheet.bar)}
      onRunTogether={() => runTogether(sheet.learned)}
      onRehearse={() => rehearseLearned(sheet.learned)}
      onClose={() => setSheet(null)}
    />
  )
  const popovers =
    popover?.name === 'speed' ? (
      <AnchoredPopover anchor={popover.anchor} label="Speed" className="popover--speed" onClose={() => setPopover(null)}>
        <SpeedPopover speed={dance.speed} onChange={setSpeed} />
      </AnchoredPopover>
    ) : popover?.name === 'sound' ? (
      <AnchoredPopover anchor={popover.anchor} label="Sound" className="popover--sound" onClose={() => setPopover(null)}>
        <SoundPopover sound={dance.sound} onChange={setSound} />
      </AnchoredPopover>
    ) : null

  return (
    <div
      className={`learn${desktop ? ' desk' : ''}`}
      data-mode="learn"
      data-layout={layout}
      data-wide={wide || undefined}
      style={{ ...(aspect ? { '--ar': aspect } : {}), '--controls-h': `${controlsH}px` } as CSSProperties}
    >
      {/* The video stays at this position in every layout so resizing or
          rotating never remounts it (and never loses the playhead). */}
      <div className={desktop ? 'desk-frame' : 'learn__stage'}>
        <VideoStage
          src={src}
          mirror={dance.mirror}
          sides
          crop={dance.crop}
          videoSize={videoSize}
          fit="contain"
          videoRef={videoRef}
          onTap={togglePlay}
          onLoadedMetadata={(v) => {
            v.playbackRate = dance.speed
            if (loopBar != null) v.currentTime = barStart(loopBar, grid)
            setDuration(v.duration)
            setVideoSize({ w: v.videoWidth, h: v.videoHeight })
          }}
        />
        {countInOverlay}
        {/* Laptop: everything is placed around (or over) the frame. */}
        {desktop && (
          <>
            <div className="desk-count">{count}</div>
            <div className="desk-frame__tools">{toolColumn}</div>
            <div className="desk-frame__speed">{speedButton}</div>
            <div className="desk-frame__transport">{transportBar}</div>
            <div className="desk-frame__got-it">{gotItButton}</div>
            {nudgeToast}
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
            right={<ShortcutsButton keys={SHORTCUTS} open={popover?.name === 'keys'} onToggle={toggleKeys} />}
          />
          {/* The waveform strip, docked at the bottom of the screen */}
          <footer className="desk-dock">
            <div className="desk-dock__wave" data-coach="strip">
              <GlassButton icon="back" label="Back one beat" size={36} onClick={() => step(-1)} />
              {strip('all')}
              <GlassButton icon="back" flip label="Forward one beat" size={36} onClick={() => step(1)} />
            </div>
          </footer>
          {popovers}
          {gotItSheet}
          {coaching && <CoachMarks mode="learn" marks={COACH_MARKS} onDone={() => setCoaching(false)} />}
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

            <div className="learn__middle">{count}</div>

            <footer className="learn__bottom">
              {/* Floats over the bottom of the video: speed · transport · Got it */}
              <div className="learn__controls">
                {speedButton}
                {transportBar}
                {gotItButton}
              </div>
              <div ref={stripRef} className="learn__strip" data-coach="strip">
                {strip('current', layout === 'portrait' ? 64 : 56)}
              </div>
            </footer>
          </div>
          {/* Tool column on the right edge, centred on the video */}
          <div className="learn__tools">{toolColumn}</div>
          {popovers}
          {nudgeToast}
          {gotItSheet}
          {coaching && <CoachMarks mode="learn" marks={COACH_MARKS} onDone={() => setCoaching(false)} />}
        </>
      )}
    </div>
  )
}

/** After "Got it": what next? */
function GotItSheet({
  bar,
  learned,
  bars,
  onNext,
  onRunTogether,
  onRehearse,
  onClose,
}: {
  bar: number
  learned: number[]
  bars: number
  onNext: () => void
  onRunTogether: () => void
  onRehearse: () => void
  onClose: () => void
}) {
  const last = lastLearned(learned)
  const done = learned.length >= bars
  return (
    <div className="got-sheet" role="dialog" aria-modal aria-label={`Bar ${bar} learned`}>
      <button type="button" className="got-sheet__scrim" aria-label="Close" onClick={onClose} />
      <div className="got-sheet__panel">
        <span className="got-sheet__handle" />
        <div className="got-sheet__head">
          <span className="got-sheet__tick">
            <Icon name="check" size={20} />
          </span>
          <div>
            <h2 className="mk-heading-m">{done ? 'You’ve got the whole dance' : `Bar ${bar}, got it`}</h2>
            <p className="mk-label-mono">
              {learned.length} of {bars} learned
            </p>
          </div>
        </div>
        {bar < bars && <Button onClick={onNext}>Next up: bar {bar + 1}</Button>}
        <Button variant="secondary" onClick={onRunTogether}>
          {last > 1 ? `Run 1–${last}` : 'Run bar 1 again'}
        </Button>
        <Button variant="secondary" onClick={onRehearse}>
          Rehearse it
        </Button>
      </div>
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
    <>
      <div className="popover__head mk-label-mono">
        <span>Speed</span>
        <span>Same pitch</span>
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
    </>
  )
}

const SOUND_OPTIONS: { value: Sound; title: string; hint: string; disabled?: boolean }[] = [
  { value: 'voice', title: 'Counts only', hint: 'Counts out loud, no music' },
  { value: 'music+voice', title: 'Music + counts', hint: 'Counts over the music' },
  { value: 'music', title: 'Music only', hint: 'Just the music' },
]

function SoundPopover({ sound, onChange }: { sound: Sound; onChange: (s: Sound) => void }) {
  return (
    <>
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
          <span className="sound-option__radio">{sound === o.value && <Icon name="check" size={20} />}</span>
          <span className="sound-option__text">
            <span className="mk-body-strong">{o.title}</span>
            <span className="mk-body-small">{o.hint}</span>
          </span>
        </button>
      ))}
    </>
  )
}
