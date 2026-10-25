import { useRef } from 'react'
import { Icon } from '../components/Icon'
import type { Dance } from '../types'
import './Library.css'

// Placeholder library for Phase 2: open the demo or add a clip.
// The full 01 Library design (grid, thumbnails, ⋯ menu) lands in Phase 5.
type Props = {
  dances: Dance[]
  onOpen: (id: string) => void
  onAdd: (file: File) => void
}

export function Library({ dances, onOpen, onAdd }: Props) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <main className="library" data-mode="learn">
      <p className="library__wordmark mk-heading-m">
        mark<span>.</span>
      </p>
      <header className="library__head">
        <h1 className="mk-heading-xl">Your dances</h1>
        <button
          type="button"
          className="library__add mk-glass"
          aria-label="Add a dance"
          onClick={() => input.current?.click()}
        >
          <Icon name="add" size={22} />
        </button>
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onAdd(file)
          }}
        />
      </header>
      <p className="library__meta mk-label-mono">
        Saved on this device
      </p>

      <ul className="library__list">
        {dances.map((d) => (
          <li key={d.id}>
            <button type="button" className="library__item" onClick={() => onOpen(d.id)}>
              <span className="mk-body-strong">{d.name}</span>
              <span className="mk-label-mono">
                {formatTime(d.duration)} · {d.bars} bars · {Math.round(d.bpm)} bpm
                {d.id === 'demo' && ' · demo'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
