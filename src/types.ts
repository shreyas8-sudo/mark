import type { Crop } from './lib/crop'

// voice: spoken 1–8, video muted · music+voice: both (voice ~70%) · music: video only
export type Sound = 'voice' | 'music+voice' | 'music'

export type Loop = { speed: number; plays: number }

export type Dance = {
  id: string
  name: string
  createdAt: number
  video: Blob | string // Blob for user clips, URL for the bundled demo
  thumb?: Blob | string // poster frame for the library card
  peaks?: Float32Array // cached waveform (max |sample| per bucket, channel 0)
  duration: number
  bpm: number
  offset: number // time of the first "1"
  bars: number
  mirror: boolean
  crop: Crop
  orientation: 'vertical' | 'horizontal'
  speed: number // remembered per dance; new dances start at 0.5
  sound: Sound
  countIn: boolean // Learn: 5-6-7-8 before playing from pause
  run: { barStart: number; barEnd: number; countIn: boolean; voice?: boolean; loops: Loop[] }
}
