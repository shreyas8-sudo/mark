import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Ambient } from '../components/Ambient'
import { BarStrip } from '../components/BarStrip'
import { CoachMarks, type CoachMark } from '../components/CoachMarks'
import { Button, GlassButton, ModeCarousel, Toggle } from '../components/controls'
import { Icon } from '../components/Icon'
import { VideoStage } from '../components/VideoStage'
import { usePeaks } from '../hooks/usePeaks'
import { barStart } from '../lib/beat'
import { coachMarksDone } from '../lib/coachMarks'
import { formatSpeed, SPEED_MAX, SPEED_MIN } from '../lib/speed'
import type { Dance, Loop } from '../types'
import './Rehearse.css'

type Run = Dance['run']

// First visit to Rehearse only.
const COACH_MARKS: CoachMark[] = [
  { target: 'run-bars', text: 'Rehearse runs what you’ve learned' },
  { target: 'count-in', text: '5-6-7-8 gives you time to get in place' },
  { target: 'loops', text: 'Each loop gets a little faster' },
]

type Props = {
  dance: Dance
  src: string
  onBack: () => void
  onLearn: () => void
  onChange: (run: Run) => void
  onStart: () => void
}

/** 07 Rehearse · Setup: bar range, count-in, loops. */
export function RehearseSetup({ dance, src, onBack, onLearn, onChange, onStart }: Props) {
  const { run } = dance
  const peaks = usePeaks(dance)
  const grid = useMemo(() => ({ bpm: dance.bpm, offset: dance.offset }), [dance.bpm, dance.offset])
  const [sheet, setSheet] = useState<{ index: number | null } | null>(null) // null index = add
  const range = `Bars ${run.barStart} → ${run.barEnd}`
  const videoRef = useRef<HTMLVideoElement>(null)
  const [coaching, setCoaching] = useState(() => !coachMarksDone('rehearse'))

  // Narrow windows dock the sheet at the bottom; the video then gets the
  // space above it. Wide ones dock it on the right (all CSS).
  const sheetRef = useRef<HTMLElement>(null)
  const [sheetH, setSheetH] = useState(0)
  useLayoutEffect(() => {
    const el = sheetRef.current!
    const measure = () => setSheetH(window.innerHeight - el.getBoundingClientRect().top)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const setLoops = (loops: Loop[]) => onChange({ ...run, loops })

  return (
    <main className="rehearse-setup" data-mode="rehearse" style={{ '--sheet-h': `${sheetH}px` } as CSSProperties}>
      <Ambient videoRef={videoRef} />
      <div className="rehearse-setup__stage">
        <VideoStage
          src={src}
          mirror={dance.mirror}
          sides
          crop={dance.crop}
          videoSize={dance.videoSize}
          fit="contain"
          videoRef={videoRef}
          onLoadedMetadata={(v) => {
            v.currentTime = barStart(run.barStart, dance)
          }}
        />
      </div>
      <div className="rehearse-setup__scrim" />
      <header className="rehearse-setup__top">
        <GlassButton icon="back" label="Back to library" onClick={onBack} />
        <ModeCarousel mode="rehearse" onChange={(m) => m === 'learn' && onLearn()} />
        <span className="rehearse-setup__spacer" />
      </header>

      <section ref={sheetRef} className="rehearse-setup__sheet">
        <h1 className="mk-heading-m">Your run</h1>

        <div className="rehearse-setup__group" data-coach="run-bars">
          <div className="rehearse-setup__label mk-label-mono">
            <span>Bars</span>
            <span className="rehearse-setup__hint">Drag the ends</span>
          </div>
          <BarStrip
            peaks={peaks}
            duration={dance.duration}
            grid={grid}
            bars={dance.bars}
            labels="all"
            range={{ start: run.barStart, end: run.barEnd }}
            onRange={(barStart, barEnd) => onChange({ ...run, barStart, barEnd })}
          />
        </div>

        <div className="rehearse-card" data-coach="count-in">
          <div className="rehearse-card__text">
            <span className="mk-body-strong">Count-in</span>
            <span className="mk-body-small">5-6-7-8 before each loop</span>
          </div>
          <Toggle label="Count-in" on={run.countIn} onChange={(countIn) => onChange({ ...run, countIn })} />
        </div>

        <div className="rehearse-card">
          <div className="rehearse-card__text">
            <span className="mk-body-strong">Counts out loud</span>
            <span className="mk-body-small">Over the music</span>
          </div>
          <Toggle label="Counts out loud" on={!!run.voice} onChange={(voice) => onChange({ ...run, voice })} />
        </div>

        <div className="rehearse-setup__group" data-coach="loops">
          <span className="rehearse-setup__label mk-label-mono">Loops</span>
          <div className="loop-cards">
            {run.loops.map((loop, i) => (
              <div key={i} className="loop-card">
                <div className="loop-card__row">
                  <span className="loop-card__index mk-data-mono">{String(i + 1).padStart(2, '0')}</span>
                  <button
                    type="button"
                    className="loop-card__icon"
                    aria-label={`Delete loop ${i + 1}`}
                    onClick={() => setLoops(run.loops.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <div className="loop-card__row">
                  <span className="loop-card__speed">
                    {formatSpeed(loop.speed)}
                    {loop.plays > 1 && <span className="loop-card__plays mk-data-mono">× {loop.plays}</span>}
                  </span>
                  <button
                    type="button"
                    className="loop-card__icon"
                    aria-label={`Edit loop ${i + 1}: speed and plays`}
                    onClick={() => setSheet({ index: i })}
                  >
                    <Icon name="edit" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="rehearse-setup__add mk-body-strong" onClick={() => setSheet({ index: null })}>
            <Icon name="add" size={20} />
            Add loop
          </button>
        </div>

        <Button className="rehearse-setup__start" disabled={!run.loops.length} onClick={onStart}>
          Let’s run it
        </Button>
      </section>

      {coaching && <CoachMarks mode="rehearse" marks={COACH_MARKS} onDone={() => setCoaching(false)} />}

      {sheet && (
        <LoopSheet
          number={(sheet.index ?? run.loops.length) + 1}
          range={range}
          initial={sheet.index == null ? { speed: 1, plays: 1 } : run.loops[sheet.index]}
          editing={sheet.index != null}
          onCancel={() => setSheet(null)}
          onSave={(loop) => {
            const i = sheet.index
            setLoops(i == null ? [...run.loops, loop] : run.loops.map((l, j) => (j === i ? loop : l)))
            setSheet(null)
          }}
        />
      )}
    </main>
  )
}

const SPEED_CHIPS = [0.5, 0.75, 1, 1.25]

/** 07a Add a loop: speed + plays. */
function LoopSheet({
  number,
  range,
  initial,
  editing,
  onCancel,
  onSave,
}: {
  number: number
  range: string
  initial: Loop
  editing: boolean
  onCancel: () => void
  onSave: (loop: Loop) => void
}) {
  const [speed, setSpeed] = useState(initial.speed)
  const [plays, setPlays] = useState(initial.plays)
  const pct = ((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100

  return (
    <div className="loop-sheet" role="dialog" aria-modal aria-label={editing ? 'Edit loop' : 'Add a loop'}>
      <button type="button" className="loop-sheet__scrim" aria-label="Cancel" onClick={onCancel} />
      <div className="loop-sheet__panel">
        <span className="loop-sheet__handle" />
        <div className="loop-sheet__head">
          <h2 className="mk-heading-m">{editing ? 'Edit loop' : 'Add a loop'}</h2>
          <p className="mk-label-mono">
            Loop {String(number).padStart(2, '0')} · {range}
          </p>
        </div>

        <div className="loop-sheet__speed">
          <div className="loop-sheet__speed-head">
            <span className="mk-label-mono">Speed</span>
            <output className="mk-heading-l">{formatSpeed(speed)}</output>
          </div>
          <input
            type="range"
            className="mk-slider"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={0.05}
            value={speed}
            style={{ '--fill': `${pct}%` } as React.CSSProperties}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Loop speed"
          />
          <div className="loop-sheet__chips">
            {SPEED_CHIPS.map((s) => (
              <button
                key={s}
                type="button"
                className="speed-chip mk-data-mono"
                data-active={s === speed || undefined}
                onClick={() => setSpeed(s)}
              >
                {formatSpeed(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="rehearse-card rehearse-card--sunken">
          <div className="rehearse-card__text">
            <span className="mk-body-strong">Times</span>
            {/* Manrope has no arrow glyph (Geist Mono does), so say it in words here. */}
            <span className="mk-body-small">Run {range.toLowerCase().replace('→', 'to')} this many times</span>
          </div>
          <button
            type="button"
            className="stepper-btn mk-heading-m"
            aria-label="Fewer plays"
            disabled={plays <= 1}
            onClick={() => setPlays((p) => p - 1)}
          >
            −
          </button>
          <span className="mk-data-mono" aria-live="polite">× {plays}</span>
          <button
            type="button"
            className="stepper-btn mk-heading-m"
            aria-label="More plays"
            disabled={plays >= 10}
            onClick={() => setPlays((p) => p + 1)}
          >
            +
          </button>
        </div>

        <div className="loop-sheet__actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ speed: Math.round(speed * 100) / 100, plays })}>
            {editing ? 'Save loop' : 'Add loop'}
          </Button>
        </div>
      </div>
    </div>
  )
}
