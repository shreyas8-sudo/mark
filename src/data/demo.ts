import { barCount } from '../lib/beat'
import { FULL_FRAME } from '../lib/crop'
import type { Dance } from '../types'
import grid from './demo.json'

// Grid computed once with analyze() and committed, so the demo opens instantly.
export const DEMO: Dance = {
  id: 'demo',
  name: grid.name,
  createdAt: 0,
  video: '/demo/demo.mp4',
  thumb: '/demo/thumb.jpg',
  duration: grid.duration,
  bpm: grid.bpm,
  offset: grid.offset,
  bars: barCount(grid.duration, grid),
  mirror: true,
  crop: FULL_FRAME,
  orientation: 'vertical',
  speed: 0.5,
  sound: 'voice',
  countIn: true,
  learned: [],
  currentBar: 1,
  run: {
    barStart: 1,
    barEnd: 1, // follows the last learned bar

    countIn: true,
    loops: [
      { speed: 0.5, plays: 1 },
      { speed: 0.75, plays: 1 },
      { speed: 1, plays: 1 },
    ],
  },
}
