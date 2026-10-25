import add from '../assets/icons/add.svg'
import back from '../assets/icons/back.svg'
import check from '../assets/icons/check.svg'
import close from '../assets/icons/close.svg'
import edit from '../assets/icons/edit.svg'
import frame from '../assets/icons/frame.svg'
import loop from '../assets/icons/loop.svg'
import mirror from '../assets/icons/mirror.svg'
import more from '../assets/icons/more.svg'
import next from '../assets/icons/next.svg'
import pause from '../assets/icons/pause.svg'
import play from '../assets/icons/play.svg'
import prev from '../assets/icons/prev.svg'
import restart from '../assets/icons/restart.svg'
import sound from '../assets/icons/sound.svg'
import speed from '../assets/icons/speed.svg'
import trash from '../assets/icons/trash.svg'

const icons = {
  add, back, check, close, edit, frame, loop, mirror, more,
  next, pause, play, prev, restart, sound, speed, trash,
}

export type IconName = keyof typeof icons

// The Figma SVGs are used as masks so their colour follows `currentColor`
// (text/primary by default, inverse on solid controls).
export function Icon({ name, size = 24, flip }: { name: IconName; size?: number; flip?: boolean }) {
  const url = `url("${icons[name]}")`
  return (
    <span
      aria-hidden
      className="mk-icon"
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    />
  )
}
