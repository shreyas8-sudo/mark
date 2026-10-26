// On-device library in IndexedDB. Settings and media live in separate
// stores so moving the speed slider rewrites a few hundred bytes, never
// the video. Nothing here touches the network.
import { createStore, del, entries, get, set } from 'idb-keyval'
import { demoById, DEMOS } from '../data/demo'
import { barCount } from './beat'
import { migrate } from './migrate'
import type { Dance } from '../types'

const meta = createStore('mark', 'dances')
const media = createStore('mark-media', 'media')

// The first demo kept its original flag key.
const hiddenKey = (id: string) => (id === DEMOS[0].id ? 'flag:demoHidden' : `flag:demoHidden:${id}`)
// Demo names from earlier builds, replaced by the current name.
const OLD_DEMO_NAMES = ['Demo clip']
// Media is written once (and peaks once more for clips saved before v2);
// meta is rewritten on every settings change, so it stays small.
type Meta = Omit<Dance, 'video' | 'thumb' | 'peaks'>
type Media = { video: Blob; thumb?: Blob; peaks?: Float32Array }

function toMeta(d: Dance): Meta {
  const { video: _video, thumb: _thumb, peaks: _peaks, ...rest } = d
  return rest
}

export async function loadDances(): Promise<Dance[]> {
  const [rows, ...hidden] = await Promise.all([
    entries<string, Meta>(meta),
    ...DEMOS.map((d) => get<boolean>(hiddenKey(d.id), meta)),
  ])
  const dances: Dance[] = []
  const demosSaved = new Map<string, Meta>()

  for (const [key, raw] of rows) {
    if (!key.startsWith('dance:')) continue
    const m = migrate(raw) as Meta
    if (demoById(m.id)) {
      demosSaved.set(m.id, m)
      continue
    }
    const files = await get<Media>(m.id, media)
    if (files) dances.push({ ...m, ...files }) // a record without its video is unusable
  }
  DEMOS.forEach((demo, i) => {
    if (hidden[i]) return
    let saved = demosSaved.get(demo.id)
    // Saved against an earlier demo clip: its counts, frame, learned bars and
    // run don't fit this one, so keep only the playback preferences.
    if (saved && saved.duration !== demo.duration) {
      const { name, createdAt, speed, sound, mirror, countIn } = saved
      saved = { ...demo, name, createdAt, speed, sound, mirror, countIn }
    }
    // Keep the user's settings for the demo (including corrected counts),
    // but always take the clip itself from the build.
    const { video, thumb, duration, videoSize } = demo
    const name = saved && !OLD_DEMO_NAMES.includes(saved.name) ? saved.name : demo.name
    const bpm = saved?.bpm ?? demo.bpm
    const offset = saved?.offset ?? demo.offset
    dances.push({ ...demo, ...saved, name, video, thumb, duration, videoSize, bpm, offset, bars: barCount(duration, { bpm, offset }) })
  })
  return dances.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveDance(d: Dance, withMedia = false) {
  if (withMedia && d.video instanceof Blob) {
    await set(d.id, { video: d.video, thumb: d.thumb instanceof Blob ? d.thumb : undefined, peaks: d.peaks }, media)
  }
  await set(`dance:${d.id}`, toMeta(d), meta)
  if (demoById(d.id)) await del(hiddenKey(d.id), meta)
}

/** Add peaks to a clip saved before v2 (computed the first time it's opened). */
export async function savePeaks(id: string, peaks: Float32Array) {
  const files = await get<Media>(id, media)
  if (files) await set(id, { ...files, peaks }, media)
}

export async function deleteDance(id: string) {
  await del(`dance:${id}`, meta)
  if (demoById(id)) await set(hiddenKey(id), true, meta)
  else await del(id, media)
}
