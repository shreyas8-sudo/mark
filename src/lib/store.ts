// On-device library in IndexedDB. Settings and media live in separate
// stores so moving the speed slider rewrites a few hundred bytes, never
// the video. Nothing here touches the network.
import { createStore, del, entries, get, set } from 'idb-keyval'
import { DEMO } from '../data/demo'
import type { Dance } from '../types'

const meta = createStore('mark', 'dances')
const media = createStore('mark-media', 'media')

const DEMO_HIDDEN = 'flag:demoHidden'
type Meta = Omit<Dance, 'video' | 'thumb'>
type Media = { video: Blob; thumb?: Blob }

function toMeta(d: Dance): Meta {
  const { video: _video, thumb: _thumb, ...rest } = d
  return rest
}

export async function loadDances(): Promise<Dance[]> {
  const [rows, demoHidden] = await Promise.all([entries<string, Meta>(meta), get<boolean>(DEMO_HIDDEN, meta)])
  const dances: Dance[] = []
  let demoSaved: Meta | undefined

  for (const [key, m] of rows) {
    if (!key.startsWith('dance:')) continue
    if (m.id === DEMO.id) {
      demoSaved = m
      continue
    }
    const files = await get<Media>(m.id, media)
    if (files) dances.push({ ...m, ...files }) // a record without its video is unusable
  }
  if (!demoHidden) {
    // Keep the user's settings for the demo, but always take the clip and
    // its grid from the build, in case the bundled demo changed.
    const { video, thumb, duration, bpm, offset, bars } = DEMO
    dances.push({ ...DEMO, ...demoSaved, video, thumb, duration, bpm, offset, bars })
  }
  return dances.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveDance(d: Dance, withMedia = false) {
  if (withMedia && d.video instanceof Blob) {
    await set(d.id, { video: d.video, thumb: d.thumb instanceof Blob ? d.thumb : undefined }, media)
  }
  await set(`dance:${d.id}`, toMeta(d), meta)
  if (d.id === DEMO.id) await del(DEMO_HIDDEN, meta)
}

export async function deleteDance(id: string) {
  await del(`dance:${id}`, meta)
  if (id === DEMO.id) await set(DEMO_HIDDEN, true, meta)
  else await del(id, media)
}
