import { useEffect, useMemo, useState } from 'react'
import { DEMO } from './data/demo'
import { analyze } from './lib/analyze'
import { barCount } from './lib/beat'
import { Learn } from './screens/Learn'
import { Library } from './screens/Library'
import type { Dance } from './types'

type Screen = { name: 'library' } | { name: 'learn'; id: string }

export default function App() {
  const [dances, setDances] = useState<Dance[]>([DEMO])
  const [screen, setScreen] = useState<Screen>({ name: 'library' })
  const [busy, setBusy] = useState<string | null>(null)

  const dance = screen.name === 'learn' ? dances.find((d) => d.id === screen.id) : undefined
  const src = useObjectUrl(dance?.video)

  const update = (id: string, patch: Partial<Dance>) =>
    setDances((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const add = async (file: File) => {
    setBusy(file.name)
    try {
      const a = await analyze(file)
      const d: Dance = {
        ...DEMO,
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        createdAt: Date.now(),
        video: file,
        ...a,
        bars: barCount(a.duration, a),
      }
      setDances((ds) => [d, ...ds])
      setScreen({ name: 'learn', id: d.id })
    } catch (err) {
      console.error(err)
      alert("Couldn't read the audio in that video. Try an mp4 or mov with sound.")
    } finally {
      setBusy(null)
    }
  }

  if (dance && src) {
    return (
      <Learn
        key={dance.id}
        dance={dance}
        src={src}
        onBack={() => setScreen({ name: 'library' })}
        onChange={(patch) => update(dance.id, patch)}
      />
    )
  }

  return (
    <Library
      dances={dances}
      busy={busy}
      onOpen={(id) => setScreen({ name: 'learn', id })}
      onAdd={add}
    />
  )
}

function useObjectUrl(video: Blob | string | undefined) {
  const url = useMemo(
    () => (video instanceof Blob ? URL.createObjectURL(video) : video),
    [video],
  )
  useEffect(() => () => {
    if (video instanceof Blob && url) URL.revokeObjectURL(url)
  }, [video, url])
  return url
}
