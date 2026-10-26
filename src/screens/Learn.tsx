import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Ambient } from '../components/Ambient'
import { BarStrip } from '../components/BarStrip'
import { BigCount } from '../components/BigCount'
import { CoachMarks, type CoachMark } from '../components/CoachMarks'
import { Button, DeskTopBar, GlassButton, ModeCarousel, PlayShutter, RailButton, ShortcutsButton, Toggle } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { DEMO } from '../data/demo'
import { useKeys } from '../hooks/useKeys'
import { useLayout } from '../hooks/useLayout'
import { usePeaks } from '../hooks/usePeaks'
import { usePlayhead } from '../hooks/usePlayhead'
import { useVoiceCounts } from '../hooks/useVoiceCounts'
import { barEnd, barStart, beatLen, loopTarget, position, stepBeat, type Grid } from '../lib/beat'
import { coachMarksDone } from '../lib/coachMarks'
import { audioContext, countIn as playCountIn, unlockAudio } from '../lib/countIn'
import {
  echoHandover,
  followLearned,
  lastLearned,
  markLearned,
  nextSpeed,
  NUDGE_AFTER_LOOPS,
  SLOW_SPEED,
  unmarkLearned,
} from '../lib/learn'
import { formatSpeed, SPEED_MAX, SPEED_MIN } from '../lib/speed'
import { loadVoices, playVoices, type VoiceName } from '../lib/voice'
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
  ['Enter', 'Got it ✓'],
  ['F', 'Edit frame'],
  ['?', 'Show shortcuts'],
]

type Popover = 'speed' | 'sound' | 'keys' | null

// First visit only, over the demo.
const COACH_MARKS: CoachMark[] = [
  { target: 'strip', text: 'Tap a chunk to jump to a bar' },
  { target: 'speed', text: 'Start slow. Speed up when it clicks' },
  { target: 'got-it', text: "Got it? Tap ✓, then rehearse what you've learned" },
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
  const [aspect, setAspect] = useState<number | null>(null)
  // Guided: open on the bar being learned, looping it.
  const [loopBar, setLoopBar] = useState<number | null>(() => Math.min(Math.max(1, dance.currentBar), dance.bars))
  const [runEnd, setRunEnd] = useState<number | null>(null) // "Run 1–N together"
  const [sheet, setSheet] = useState<{ bar: number; learned: number[] } | null>(null)
  const [coaching, setCoaching] = useState(() => dance.id === DEMO.id && !coachMarksDone())
  // "Your turn" echo: video does 1–4, the dancer does 5–8 to spoken counts.
  const [echo, setEcho] = useState(false)
  const [yourTurn, setYourTurn] = useState(false)
  const cancelTurn = useRef<(() => void) | null>(null)
  // Speed-up nudge after a few laps of the same bar at the same speed.
  const laps = useRef({ key: '', count: 0 })
  const nudged = useRef(new Set<string>())
  const [nudge, setNudge] = useState<number | null>(null)
  const [popover, setPopover] = useState<Popover>(null)
  const [controlsH, setControlsH] = useState(0)
  const [countingIn, setCountingIn] = useState<number | null>(null) // 5–8 on screen
  const cancelCountIn = useRef<(() => void) | null>(null)
  const peaks = usePeaks(dance, onPeaks)

  // Per-frame work (run-through end, echo handover, bar loop) is defined
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

  const echoBar = loopBar ?? currentBar
  useVoiceCounts(videoRef, {
    enabled: dance.sound !== 'music' || echo,
    grid,
    volume: dance.sound === 'voice' ? 1 : 0.7,
    stopAt:
      echo ? echoHandover(barStart(echoBar, grid), beatLen(grid))
      : runEnd != null ? barEnd(runEnd, grid)
      : loopBar != null ? barEnd(loopBar, grid)
      : null,
    yourTurnOnFour: echo,
    skipAt: echo ? barStart(echoBar, grid) : null, // the echo engine says that "1"
  })

  // Remember where guided Learn resumes.
  const { currentBar: savedBar } = dance
  useEffect(() => {
    if (loopBar != null && loopBar !== savedBar) onChange({ currentBar: loopBar })
  }, [loopBar, savedBar, onChange])

  useEffect(
    () => () => {
      cancelCountIn.current?.()
      cancelTurn.current?.()
    },
    [],
  )

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
  // ---- "Your turn" echo ----
  const stopYourTurn = () => {
    cancelTurn.current?.()
    cancelTurn.current = null
    setYourTurn(false)
    setCountingIn(null)
  }
  /** Freeze on 5; the voice counts 5–8 on the beat; the video picks up at the next 1. */
  function startYourTurn(bar: number) {
    const v = videoRef.current
    if (!v) return
    v.pause()
    const beatReal = beatLen(grid) / v.playbackRate
    const timers: number[] = []
    let voices: { cancel: () => void } | null = null
    let cancelled = false
    cancelTurn.current = () => {
      cancelled = true
      timers.forEach(clearTimeout)
      voices?.cancel()
    }
    setYourTurn(true)
    // When count 5 *should* have sounded, on the audio clock: the frame that
    // noticed the handover may be a little late, and the rest of the bar
    // (and the restart on 1) must stay on the beat grid regardless.
    const ctx = audioContext()
    const lateBy = (v.currentTime - echoHandover(barStart(bar, grid), beatLen(grid))) / v.playbackRate
    const t0 = ctx.currentTime - Math.max(0, lateBy)
    void loadVoices().then((clips) => {
      if (cancelled) return
      // 5-6-7-8 for the dancer, then the "1" the video restarts on.
      voices = playVoices(
        clips,
        ['5', '6', '7', '8', '1'].map((name, i) => ({
          name: name as VoiceName,
          at: Math.max(t0 + i * beatReal, ctx.currentTime + 0.005), // "5" now if already due
        })),
      )
      const at = (i: number) => Math.max(0, (t0 + i * beatReal - ctx.currentTime) * 1000)
      ;[5, 6, 7, 8].forEach((c, i) => timers.push(window.setTimeout(() => setCountingIn(c), at(i))))
      // Cue the video at the top of the bar on 8, so it can start right on 1.
      timers.push(window.setTimeout(() => (v.currentTime = barStart(bar, grid)), at(3)))
      timers.push(
        window.setTimeout(() => {
          cancelTurn.current = null
          setYourTurn(false)
          setCountingIn(null)
          countLap(bar)
          void v.play().catch(() => {})
        }, at(4)),
      )
    })
  }
  const toggleEcho = (on: boolean) => {
    stopYourTurn()
    setEcho(on)
    if (on && loopBar == null) setLoopBar(currentBar) // echo works one bar at a time
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
      if (echo) {
        if (cancelTurn.current) return
        const bar = loopBar ?? Math.min(position(video.currentTime, grid).bar, dance.bars)
        if (video.currentTime >= echoHandover(barStart(bar, grid), beatLen(grid))) startYourTurn(bar)
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
    if (cancelTurn.current) return stopYourTurn() // ...and during your turn
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
    c: toggleCountIn,
    f: onEditFrame,
    Enter: gotIt,
    '?': () => togglePopover('keys'),
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
  const speedPill = (
    <button
      type="button"
      className="speed-pill mk-glass"
      data-coach="speed"
      data-open={popover === 'speed' || undefined}
      aria-label={`Speed ${dance.speed}×`}
      aria-expanded={popover === 'speed'}
      onClick={() => togglePopover('speed')}
    >
      {formatSpeed(dance.speed)}
    </button>
  )
  const desktop = layout === 'desktop'
  const railIcon = layout === 'landscape' ? 16 : 28
  const count =
    countingIn != null ? <BigCount count={countingIn} beat={countingIn} countIn caption={yourTurn ? 'Your turn' : undefined} />
    : <BigCount count={pos.count} beat={pos.beatIndex} />
  const nudgeToast = nudge != null && (
    <div className="nudge mk-glass" role="status">
      <span className="mk-body-strong">Feeling it? Try {formatSpeed(nudge)}</span>
      <button
        type="button"
        className="nudge__try mk-body-strong"
        onClick={() => {
          setSpeed(nudge)
          setNudge(null)
        }}
      >
        Try it
      </button>
      <button type="button" className="nudge__close" aria-label="Dismiss" onClick={() => setNudge(null)}>
        <Icon name="close" size={16} />
      </button>
    </div>
  )
  const countInGlyph = '5–8'
  const thisBarLearned = dance.learned.includes(loopBar ?? currentBar)
  const gotItButton = (size = 40) => (
    <GlassButton
      icon="check"
      label="Got it"
      size={size}
      iconSize={Math.round(size * 0.5)}
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
  const popovers = (
    <>
      {(popover === 'speed' || popover === 'sound') && (
        <button type="button" className="popover-dismiss" aria-label="Close" onClick={() => setPopover(null)} />
      )}
      {popover === 'speed' && <SpeedPopover speed={dance.speed} onChange={setSpeed} />}
      {popover === 'sound' && <SoundPopover sound={dance.sound} onChange={setSound} echo={echo} onEcho={toggleEcho} />}
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
            v.playbackRate = dance.speed
            if (loopBar != null) v.currentTime = barStart(loopBar, grid)
            setDuration(v.duration)
            setAspect((dance.crop.w * v.videoWidth) / (dance.crop.h * v.videoHeight))
          }}
        />
        {desktop && (
          <nav className="desk-frame__tools" aria-label="Tools">
            <GlassButton icon="sound" label="Sound" size={36} iconSize={18} className={popover === 'sound' ? 'is-open' : ''} aria-expanded={popover === 'sound'} onClick={() => togglePopover('sound')} />
            <GlassButton icon="mirror" label="Mirror" size={36} iconSize={18} className={dance.mirror ? 'is-on' : ''} aria-pressed={dance.mirror} onClick={toggleMirror} />
            <GlassButton glyph={countInGlyph} label="Count-in" size={36} className={dance.countIn ? 'is-on' : ''} aria-pressed={dance.countIn} onClick={toggleCountIn} />
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
            <div className="desk-dock__wave" data-coach="strip">
              <GlassButton icon="back" label="Back one beat" size={36} iconSize={16} onClick={() => step(-1)} />
              {strip('all')}
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
            <div className="desk-dock__end">
              {speedPill}
              <Button className="got-it-pill" data-coach="got-it" onClick={gotIt}>
                <Icon name="check" size={18} /> Got it
              </Button>
            </div>
          </footer>
          {popovers}
          {nudgeToast}
          {gotItSheet}
          {coaching && <CoachMarks marks={COACH_MARKS} onDone={() => setCoaching(false)} />}
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
              {count}
              {/* Portrait: labelled rail on the right. Landscape: compact
                  icon row at the top right, camera-app style. */}
              <nav className="learn__rail" aria-label="Tools">
                <RailButton icon="sound" iconSize={railIcon} label="Sound" open={popover === 'sound'} onClick={() => togglePopover('sound')} />
                <RailButton icon="mirror" iconSize={railIcon} label="Mirror" on={dance.mirror} onClick={toggleMirror} />
                <RailButton glyph={countInGlyph} label="Count-in" on={dance.countIn} onClick={toggleCountIn} />
                <RailButton icon="loop" iconSize={railIcon} label="Loop" on={loopBar != null} onClick={toggleLoop} />
                <RailButton icon="frame" iconSize={railIcon} label="Frame" onClick={onEditFrame} />
              </nav>
            </div>

            <footer className="learn__bottom">
              {/* Floats over the bottom of the video to leave it the space. */}
              <div className="transport">
                <GlassButton icon="restart" label="Restart" onClick={restart} />
                <GlassButton icon="back" label="Back one beat" iconSize={18} onClick={() => step(-1)} />
                <PlayShutter playing={playing} onClick={togglePlay} />
                <GlassButton icon="back" flip label="Forward one beat" iconSize={18} onClick={() => step(1)} />
                {speedPill}
                {gotItButton()}
              </div>
              <div ref={stripRef} className="learn__strip" data-coach="strip">
                {strip('current', layout === 'portrait' ? 64 : 56)}
              </div>
            </footer>
          </div>
          {popovers}
          {nudgeToast}
          {gotItSheet}
          {coaching && <CoachMarks marks={COACH_MARKS} onDone={() => setCoaching(false)} />}
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
            <h2 className="mk-heading-m">{done ? 'Whole dance learned' : `Bar ${bar} learned`}</h2>
            <p className="mk-label-mono">
              {learned.length} of {bars} learned
            </p>
          </div>
        </div>
        {bar < bars && <Button onClick={onNext}>Next bar · {bar + 1}</Button>}
        <Button variant="secondary" onClick={onRunTogether}>
          {last > 1 ? `Run 1–${last} together` : 'Run bar 1 again'}
        </Button>
        <Button variant="secondary" onClick={onRehearse}>
          Rehearse what I've learned
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
  { value: 'voice', title: 'Voice counts', hint: 'Spoken 1–8, music off' },
  { value: 'music+voice', title: 'Music + voice', hint: 'Counts spoken over the track' },
  { value: 'music', title: 'Music only', hint: 'Just the track' },
]

function SoundPopover({
  sound,
  onChange,
  echo,
  onEcho,
}: {
  sound: Sound
  onChange: (s: Sound) => void
  echo: boolean
  onEcho: (on: boolean) => void
}) {
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
      <div className="sound-echo">
        <span className="sound-option__text">
          <span className="mk-body-strong">Your turn</span>
          <span className="mk-body-small">Video does 1–4, you do 5–8</span>
        </span>
        <Toggle label="Your turn echo" on={echo} onChange={onEcho} />
      </div>
    </div>
  )
}
