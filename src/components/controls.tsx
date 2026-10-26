import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** Round glass button (back, more, transport). */
export function GlassButton({
  icon,
  glyph,
  label,
  size = 40,
  iconSize,
  flip,
  className = '',
  ...rest
}: { icon?: IconName; glyph?: ReactNode; label: string; size?: number; iconSize?: number; flip?: boolean } & ButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`glass-btn mk-glass ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={iconSize ?? Math.round(size * 0.48)} flip={flip} /> : <span className="glyph mk-label-mono">{glyph}</span>}
    </button>
  )
}

/** Primary play/pause: a plain solid circle. */
export function PlayShutter({
  playing,
  iconSize = 24,
  className = '',
  ...rest
}: { playing: boolean; iconSize?: number } & ButtonProps) {
  return (
    <button
      type="button"
      className={`shutter ${className}`}
      aria-label={playing ? 'Pause' : 'Play'}
      {...rest}
    >
      <Icon name={playing ? 'pause' : 'play'} size={iconSize} />
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

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: { variant?: 'primary' | 'secondary' } & ButtonProps) {
  return <button type="button" className={`mk-button mk-button--${variant} mk-body-strong ${className}`} {...rest} />
}

export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="mk-toggle"
      onClick={() => onChange(!on)}
    >
      <span className="mk-toggle__knob" />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  label,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  label: string
  onChange: (v: T) => void
}) {
  return (
    <div className="mk-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="mk-segmented__option mk-body-strong"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Laptop / TV top bar: Library pill, dance title + meta, mode switch. */
export function DeskTopBar({
  title,
  meta,
  mode,
  onBack,
  onMode,
  right,
}: {
  title: string
  meta: string
  mode: 'learn' | 'rehearse'
  onBack: () => void
  onMode: (mode: 'learn' | 'rehearse') => void
  right?: ReactNode
}) {
  return (
    <header className="desk-top">
      <button type="button" className="desk-top__back mk-glass mk-body-strong" onClick={onBack}>
        <Icon name="back" size={18} />
        Library
      </button>
      <div className="desk-top__title">
        <span className="mk-body-strong">{title}</span>
        <span className="mk-label-mono">{meta}</span>
      </div>
      <div className="desk-top__mode">
        <ModeCarousel mode={mode} onChange={(m) => m !== mode && onMode(m)} />
      </div>
      {right && <div className="desk-top__right">{right}</div>}
    </header>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mk-kbd mk-label-mono">{children}</kbd>
}

/** The `?` keyboard-shortcuts popover on laptop layouts. */
export function ShortcutsButton({ keys, open, onToggle }: { keys: [string, string][]; open: boolean; onToggle: () => void }) {
  return (
    <div className="shortcuts">
      <button type="button" className="shortcuts__btn mk-glass mk-body-strong" aria-label="Keyboard shortcuts" aria-expanded={open} onClick={onToggle}>
        ?
      </button>
      {open && (
        <div className="shortcuts__pop popover" role="dialog" aria-label="Keyboard shortcuts">
          <span className="popover__head mk-label-mono">Keyboard</span>
          {keys.map(([k, what]) => (
            <p key={k}>
              <Kbd>{k}</Kbd> {what}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
