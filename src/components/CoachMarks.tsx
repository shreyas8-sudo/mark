import { useLayoutEffect, useState, type ReactNode } from 'react'
import { markCoachMarksDone, type CoachMode } from '../lib/coachMarks'
import './CoachMarks.css'

export type CoachMark = { target: string; text: ReactNode }

type Rect = { left: number; top: number; width: number; height: number }

/** The first visible element for a coach mark's `data-coach` target. */
function findTarget(name: string): Rect | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-coach="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width && r.height) return { left: r.left, top: r.top, width: r.width, height: r.height }
  }
  return null
}

const PAD = 6
const BUBBLE_W = 260

/**
 * First-visit coach marks for one mode: a spotlight on each target in turn
 * with a short tip, Next / Done, and Skip. Finishing marks this mode done;
 * Skip turns the tips off for both modes.
 */
export function CoachMarks({ mode, marks, onDone }: { mode: CoachMode; marks: CoachMark[]; onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const mark = marks[index]

  useLayoutEffect(() => {
    // Targets inside a scrolling sheet (Rehearse) may start out of view.
    document.querySelector(`[data-coach="${mark.target}"]`)?.scrollIntoView({ block: 'nearest' })
    const update = () => setRect(findTarget(mark.target))
    update()
    window.addEventListener('resize', update)
    // Targets can move as the layout settles (e.g. the strip scrolling).
    const id = window.setInterval(update, 400)
    return () => {
      window.removeEventListener('resize', update)
      clearInterval(id)
    }
  }, [mark.target])

  const finish = (modes: CoachMode[]) => {
    markCoachMarksDone(...modes)
    onDone()
  }
  const next = () => (index + 1 < marks.length ? setIndex(index + 1) : finish([mode]))

  // Spotlight around the target; the tip sits above it (targets are low on
  // screen) or below if there's no room, kept inside the viewport.
  const spot = rect && {
    left: rect.left - PAD,
    top: rect.top - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  }
  const above = !rect || rect.top > 200
  const bubbleLeft = rect
    ? Math.min(Math.max(12, rect.left + rect.width / 2 - BUBBLE_W / 2), window.innerWidth - BUBBLE_W - 12)
    : 12
  const bubbleStyle = rect
    ? above
      ? { left: bubbleLeft, bottom: window.innerHeight - rect.top + PAD + 12 }
      : { left: bubbleLeft, top: rect.top + rect.height + PAD + 12 }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div className="coach" role="dialog" aria-modal aria-label="Getting started" data-mode={mode}>
      <button type="button" className="coach__scrim" aria-label="Next tip" onClick={next} />
      {spot && <div className="coach__spot" style={spot} />}
      <div className="coach__bubble" style={{ ...bubbleStyle, width: BUBBLE_W }} data-above={above || undefined}>
        <span className="coach__step mk-label">
          {index + 1} of {marks.length}
        </span>
        <p className="mk-body-strong">{mark.text}</p>
        <div className="coach__actions">
          <button type="button" className="coach__skip mk-body-small" onClick={() => finish(['learn', 'rehearse'])}>
            Skip
          </button>
          <button type="button" className="coach__next mk-button mk-button--primary mk-body-strong" onClick={next}>
            {index + 1 < marks.length ? 'Next' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
