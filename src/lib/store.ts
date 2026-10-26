// On-device library in IndexedDB. Settings and media live in separate
// stores so moving the speed slider rewrites a few hundred bytes, never
// the video. Nothing here touches the network.
import { createStore, del, entries, get, set } from 'idb-keyval'
import { DEMO } from '../data/demo'
import { barCount } from './beat'
import { migrate } from './migrate'
import type { Dance } from '../types'

const meta = createStore('mark', 'dances')
const media = createStore('mark-media', 'media')

const DEMO_HIDDEN = 'flag:demoHidden'
// Media is written once (and peaks once more for clips saved before v2);
// meta is rewritten on every settings change, so it stays small.
type Meta = Omit<Dance, 'video' | 'thumb' | 'peaks'>
type Media = { video: Blob; thumb?: Blob; peaks?: Float32Array }

function toMeta(d: Dance): Meta {
  const { video: _video, thumb: _thumb, peaks: _peaks, ...rest } = d
  return rest
}

export async function loadDances(): Promise<Dance[]> {
  const [rows, demoHidden] = await Promise.all([entries<string, Meta>(meta), get<boolean>(DEMO_HIDDEN, meta)])
  const dances: Dance[] = []
  let demoSaved: Meta | undefined

  for (const [key, raw] of rows) {
    if (!key.startsWith('dance:')) continue
    const m = migrate(raw) as Meta
    if (m.id === DEMO.id) {
      demoSaved = m
      continue
    }
    const files = await get<Media>(m.id, media)
    if (files) dances.push({ ...m, ...files }) // a record without its video is unusable
  }
  // Saved against an earlier demo clip: its counts, frame, learned bars and
  // run don't fit this one, so keep only the playback preferences.
  if (demoSaved && demoSaved.duration !== DEMO.duration) {
    const { name, createdAt, speed, sound, mirror, countIn } = demoSaved
    demoSaved = { ...DEMO, name, createdAt, speed, sound, mirror, countIn }
  }
  if (!demoHidden) {
    // Keep the user's settings for the demo (including corrected counts),
    // but always take the clip itself from the build.
    const { video, thumb, duration, videoSize } = DEMO
    const bpm = demoSaved?.bpm ?? DEMO.bpm
    const offset = demoSaved?.offset ?? DEMO.offset
    dances.push({ ...DEMO, ...demoSaved, video, thumb, duration, videoSize, bpm, offset, bars: barCount(duration, { bpm, offset }) })
  }
  return dances.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveDance(d: Dance, withMedia = false) {
  if (withMedia && d.video instanceof Blob) {
    await set(d.id, { video: d.video, thumb: d.thumb instanceof Blob ? d.thumb : undefined, peaks: d.peaks }, media)
  }
  await set(`dance:${d.id}`, toMeta(d), meta)
  if (d.id === DEMO.id) await del(DEMO_HIDDEN, meta)
}

/** Add peaks to a clip saved before v2 (computed the first time it's opened). */
export async function savePeaks(id: string, peaks: Float32Array) {
  const files = await get<Media>(id, media)
  if (files) await set(id, { ...files, peaks }, media)
}

export async function deleteDance(id: string) {
  await del(`dance:${id}`, meta)
  if (id === DEMO.id) await set(DEMO_HIDDEN, true, meta)
  else await del(id, media)
}
