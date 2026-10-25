import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** Round glass button (back, more, transport). */
export function GlassButton({
  icon,
  label,
  size = 40,
  iconSize,
  flip,
  className = '',
  ...rest
}: { icon: IconName; label: string; size?: number; iconSize?: number; flip?: boolean } & ButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`glass-btn mk-glass ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.48)} flip={flip} />
    </button>
  )
}

/** Labelled control on the right-hand video rail. */
export function RailButton({
  icon,
  label,
  open,
  on,
  ...rest
}: { icon: IconName; label: string; open?: boolean; on?: boolean } & ButtonProps) {
  return (
    <button
      type="button"
      className="rail-btn"
      data-open={open || undefined}
      data-on={on || undefined}
      aria-pressed={on}
      aria-expanded={open}
      {...rest}
    >
      <span className="rail-btn__disc mk-glass">
        <Icon name={icon} size={28} />
      </span>
      <span className="rail-btn__label mk-label-mono mk-over-video">{label}</span>
    </button>
  )
}

export function CountBadge({ count, sub }: { count: ReactNode; sub: ReactNode }) {
  return (
    <div className="count-badge mk-glass" aria-live="off">
      <span className="mk-count-badge">{count}</span>
      <span className="count-badge__sub mk-label-mono">{sub}</span>
    </div>
  )
}

/** Primary play/pause, styled after the camera shutter. */
export function PlayShutter({ playing, ...rest }: { playing: boolean } & ButtonProps) {
  return (
    <button
      type="button"
      className="shutter"
      aria-label={playing ? 'Pause' : 'Play'}
      {...rest}
    >
      <span className="shutter__core">
        <Icon name={playing ? 'pause' : 'play'} size={24} />
      </span>
    </button>
  )
}

/** LEARN · REHEARSE switch at the top of the player. */
export function ModeCarousel({
  mode,
  onChange,
}: {
  mode: 'learn' | 'rehearse'
  onChange?: (mode: 'learn' | 'rehearse') => void
}) {
  return (
    <div className="mode-carousel" role="tablist" aria-label="Mode">
      {(['learn', 'rehearse'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          className="mode-carousel__option mk-over-video"
          disabled={!onChange && mode !== m}
          onClick={() => onChange?.(m)}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
