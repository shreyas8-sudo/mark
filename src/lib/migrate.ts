import type { Dance, Sound } from '../types'

const SOUNDS: Record<string, Sound> = {
  voice: 'voice',
  'music+voice': 'music+voice',
  music: 'music',
  // v1 values
  'music+counts': 'voice',
  counts: 'voice',
}

/** Bring a settings record saved by an older version up to the current shape. */
type Saved = Omit<Partial<Dance>, 'sound'> & { lastSpeed?: number; sound?: string }

export function migrate(m: Saved) {
  const { lastSpeed, ...rest } = m
  return {
    ...rest,
    speed: rest.speed ?? lastSpeed ?? 0.5,
    sound: SOUNDS[rest.sound ?? ''] ?? 'voice',
    countIn: rest.countIn ?? true,
  }
}
