import { barCount } from '../lib/beat'
import { FULL_FRAME } from '../lib/crop'
import type { Dance } from '../types'
import horizontalGrid from './demo-horizontal.json'
import verticalGrid from './demo.json'

type Grid = { name: string; duration: number; bpm: number; offset: number }

function demo(id: string, grid: Grid, files: Pick<Dance, 'video' | 'thumb' | 'videoSize' | 'orientation'>): Dance {
  return {
    id,
    name: grid.name,
    createdAt: 0,
    ...files,
    duration: grid.duration,
    bpm: grid.bpm,
    offset: grid.offset,
    bars: barCount(grid.duration, grid),
    mirror: true,
    crop: FULL_FRAME,
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
}

// Grids computed once with analyze() and committed, so the demos open instantly.
export const DEMO = demo('demo', verticalGrid, {
  video: '/demo/demo.mp4',
  thumb: '/demo/thumb.jpg',
  videoSize: { w: 568, h: 840 },
  orientation: 'vertical',
})

export const DEMO_HORIZONTAL = demo('demo-horizontal', horizontalGrid, {
  video: '/demo-horizontal.mp4',
  thumb: '/demo-horizontal-thumb.jpg',
  videoSize: { w: 1072, h: 576 },
  orientation: 'horizontal',
})

export const DEMOS = [DEMO, DEMO_HORIZONTAL]

/** Waveform peaks shipped with each demo. */
export const DEMO_PEAKS: Record<string, string> = {
  [DEMO.id]: '/demo/peaks.json',
  [DEMO_HORIZONTAL.id]: '/demo-horizontal-peaks.json',
}

export const demoById = (id: string) => DEMOS.find((d) => d.id === id)
