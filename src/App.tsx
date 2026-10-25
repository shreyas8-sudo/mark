import { useEffect, useRef, useState } from 'react'
import { DEMO } from './data/demo'
import { revokeObjectUrl, useObjectUrl } from './hooks/useObjectUrl'
import { unlockAudio } from './lib/countIn'
import { deleteDance, loadDances, saveDance } from './lib/store'
import { Learn } from './screens/Learn'
import { Library } from './screens/Library'
import { Ready } from './screens/Ready'
import { RehearseRun } from './screens/RehearseRun'
import { RehearseSetup } from './screens/RehearseSetup'
import { SetupFrame } from './screens/SetupFrame'
import type { Dance } from './types'

// Library → Getting it ready → Setup · Frame → Learn. Setup runs once per
// dance; after that a dance opens straight into Learn (Frame re-opens setup).
type Screen =
  | { name: 'library' }
  | { name: 'ready'; file: File }
  | { name: 'frame'; draft: Dance; from: 'ready' | 'learn' | 'library' }
  | { name: 'learn'; id: string }
  | { name: 'rehearse'; id: string; running: boolean }

export default function App() {
  const [dances, setDances] = useState<Dance[] | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'library' })

  useEffect(() => {
    loadDances()
      .then(setDances)
      .catch((err) => {
        // Private browsing / blocked storage: still usable, just not saved.
        console.error(err)
        setDances([DEMO])
      })
  }, [])

  // Persist settings changes, debounced so a dragged slider writes once.
  const saved = useRef(new Map<string, Dance>())
  useEffect(() => {
    if (!dances) return
    const t = setTimeout(() => {
      for (const d of dances) {
        const prev = saved.current.get(d.id)
        if (prev === d) continue
        if (prev) void saveDance(d)
        saved.current.set(d.id, d)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [dances])

  const list = dances ?? []
  const dance =
    screen.name === 'learn' || screen.name === 'rehearse' ? list.find((d) => d.id === screen.id)
    : screen.name === 'frame' ? screen.draft
    : undefined
  const src = useObjectUrl(dance?.video)

  if (!dances) return null

  const update = (id: string, patch: Partial<Dance>) =>
    setDances((ds) => ds && ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const add = (d: Dance) => {
    saved.current.set(d.id, d)
    void saveDance(d, true)
    setDances((ds) => [d, ...(ds ?? [])])
  }

  const remove = (id: string) => {
    const d = list.find((x) => x.id === id)
    if (d?.video instanceof Blob) revokeObjectUrl(d.video)
    if (d?.thumb instanceof Blob) revokeObjectUrl(d.thumb)
    saved.current.delete(id)
    void deleteDance(id)
    setDances((ds) => ds && ds.filter((x) => x.id !== id))
  }

  if (screen.name === 'ready') {
    return (
      <Ready
        key={screen.file.name + screen.file.lastModified}
        file={screen.file}
        onCancel={() => {
          revokeObjectUrl(screen.file)
          setScreen({ name: 'library' })
        }}
        onDone={(draft) => setScreen({ name: 'frame', draft, from: 'ready' })}
      />
    )
  }

  if (screen.name === 'frame' && src) {
    const { draft, from } = screen
    const leave = () =>
      setScreen(from === 'learn' ? { name: 'learn', id: draft.id } : { name: 'library' })
    return (
      <SetupFrame
        src={src}
        initial={draft}
        onBack={() => {
          // Backing out of a new dance discards it.
          if (from === 'ready' && draft.video instanceof Blob) revokeObjectUrl(draft.video)
          leave()
        }}
        onSave={(settings) => {
          if (from === 'ready') add({ ...draft, ...settings })
          else update(draft.id, settings)
          if (from === 'library') leave()
          else setScreen({ name: 'learn', id: draft.id })
        }}
      />
    )
  }

  if (screen.name === 'learn' && dance && src) {
    return (
      <Learn
        key={dance.id}
        dance={dance}
        src={src}
        onBack={() => setScreen({ name: 'library' })}
        onEditFrame={() => setScreen({ name: 'frame', draft: dance, from: 'learn' })}
        onRehearse={() => setScreen({ name: 'rehearse', id: dance.id, running: false })}
        onChange={(patch) => update(dance.id, patch)}
      />
    )
  }

  if (screen.name === 'rehearse' && dance && src) {
    const toSetup = () => setScreen({ ...screen, running: false })
    return screen.running ? (
      <RehearseRun
        key={dance.id}
        dance={dance}
        src={src}
        onEnd={toSetup}
        onBack={() => setScreen({ name: 'library' })}
        onLearn={() => setScreen({ name: 'learn', id: dance.id })}
      />
    ) : (
      <RehearseSetup
        key={dance.id}
        dance={dance}
        src={src}
        onBack={() => setScreen({ name: 'library' })}
        onLearn={() => setScreen({ name: 'learn', id: dance.id })}
        onChange={(run) => update(dance.id, { run })}
        onStart={() => {
          unlockAudio() // inside the tap, so iOS lets the count-in sound
          setScreen({ ...screen, running: true })
        }}
      />
    )
  }

  return (
    <Library
      dances={list}
      onOpen={(id) => setScreen({ name: 'learn', id })}
      onAdd={(file) => setScreen({ name: 'ready', file })}
      onRename={(id, name) => update(id, { name })}
      onChangeFrame={(id) => {
        const d = list.find((x) => x.id === id)
        if (d) setScreen({ name: 'frame', draft: d, from: 'library' })
      }}
      onDelete={remove}
      onRestoreDemo={() => add({ ...DEMO, createdAt: Date.now() })}
    />
  )
}
