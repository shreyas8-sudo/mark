import type { Crop } from './lib/crop'

export type Sound = 'music' | 'music+counts' | 'counts'

export type Loop = { speed: number; plays: number }

export type Dance = {
  id: string
  name: string
  createdAt: number
  video: Blob | string // Blob for user clips, URL for the bundled demo
  duration: number
  bpm: number
  offset: number // time of the first "1"
  bars: number
  mirror: boolean
  crop: Crop
  orientation: 'vertical' | 'horizontal'
  lastSpeed: number
  sound: Sound
  run: { barStart: number; barEnd: number; countIn: boolean; loops: Loop[] }
}
