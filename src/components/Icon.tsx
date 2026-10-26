import {
  ArrowCounterClockwise,
  CaretLeft,
  Check,
  Crop,
  DotsThree,
  FlipHorizontal,
  Gauge,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Repeat,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  Trash,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'

const icons = {
  add: Plus,
  back: CaretLeft,
  check: Check,
  close: X,
  edit: PencilSimple,
  frame: Crop,
  loop: Repeat,
  mirror: FlipHorizontal,
  more: DotsThree,
  next: SkipForward,
  pause: Pause,
  play: Play,
  prev: SkipBack,
  restart: ArrowCounterClockwise,
  sound: SpeakerHigh,
  speed: Gauge,
  trash: Trash,
} satisfies Record<string, PhosphorIcon>

export type IconName = keyof typeof icons

/** The one size scale: 20 (small controls, menus), 24 (default), 28 (large). */
export type IconSize = 20 | 24 | 28

/** Bold for controls; fill for a control that's on (Loop on, Mirror on). */
export function Icon({ name, size = 24, flip, on }: { name: IconName; size?: IconSize; flip?: boolean; on?: boolean }) {
  const Glyph = icons[name]
  return <Glyph aria-hidden className="mk-icon" size={size} weight={on ? 'fill' : 'bold'} mirrored={flip} />
}
