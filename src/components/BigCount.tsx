import './BigCount.css'

type Props = {
  count: number | null
  /** Changes on every beat (e.g. the beat index), so a repeat still pulses. */
  beat: number
  /** Count-in 5-6-7-8: whole display in the accent colour. */
  countIn?: boolean
  className?: string
}

/**
 * The big pulsing count. Each beat swaps the number and pulses
 * 1 → 1.25 → 1 (count 1: → 1.35 with an accent flash). Re-keying the
 * digit restarts the CSS animation exactly on the beat.
 */
export function BigCount({ count, beat, countIn, className = '' }: Props) {
  return (
    <div className={`big-count ${className}`} data-count-in={countIn || undefined} aria-live="off">
      {count != null && (
        <span key={beat} className="big-count__digit mk-over-video" data-one={(!countIn && count === 1) || undefined}>
          {count}
        </span>
      )}
    </div>
  )
}
