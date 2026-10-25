import { useState } from 'react'
import { DEMO } from './data/demo'
import { revokeObjectUrl, useObjectUrl } from './hooks/useObjectUrl'
import { unlockAudio } from './lib/countIn'
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
  | { name: 'frame'; draft: Dance; from: 'ready' | 'learn' }
  | { name: 'learn'; id: string }
  | { name: 'rehearse'; id: string; running: boolean }

export default function App() {
  const [dances, setDances] = useState<Dance[]>([DEMO])
  const [screen, setScreen] = useState<Screen>({ name: 'library' })

  const dance =
    screen.name === 'learn' || screen.name === 'rehearse' ? dances.find((d) => d.id === screen.id)
    : screen.name === 'frame' ? screen.draft
    : undefined
  const src = useObjectUrl(dance?.video)

  const update = (id: string, patch: Partial<Dance>) =>
    setDances((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

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
    return (
      <SetupFrame
        src={src}
        initial={draft}
        onBack={() => {
          if (from === 'learn') return setScreen({ name: 'learn', id: draft.id })
          // Backing out of a new dance discards it.
          if (draft.video instanceof Blob) revokeObjectUrl(draft.video)
          setScreen({ name: 'library' })
        }}
        onSave={(settings) => {
          if (from === 'ready') setDances((ds) => [{ ...draft, ...settings }, ...ds])
          else update(draft.id, settings)
          setScreen({ name: 'learn', id: draft.id })
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
      <RehearseRun key={dance.id} dance={dance} src={src} onEnd={toSetup} />
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
      dances={dances}
      onOpen={(id) => setScreen({ name: 'learn', id })}
      onAdd={(file) => setScreen({ name: 'ready', file })}
    />
  )
}
