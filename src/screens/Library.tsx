import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import wordmarkDot from '../assets/wordmark-dot.svg'
import { Button } from '../components/controls'
import { Icon } from '../components/Icon'
import { demoById } from '../data/demo'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { formatTime } from '../lib/format'
import type { Dance } from '../types'
import './Library.css'

type Props = {
  dances: Dance[]
  onOpen: (id: string) => void
  onAdd: (file: File) => void
  onRename: (id: string, name: string) => void
  onChangeFrame: (id: string) => void
  onChangeFirstBeat: (id: string) => void
  onFixCounts: (id: string) => void
  onDelete: (id: string) => void
  onRestoreDemo: () => void
}

/** 01 Library: your dances, saved on this device. */
export function Library({ dances, onOpen, onAdd, onRename, onChangeFrame, onChangeFirstBeat, onFixCounts, onDelete, onRestoreDemo }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const pick = () => input.current?.click()

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('video/'))
    if (file) onAdd(file)
  }

  return (
    <main
      className="library"
      data-mode="learn"
      data-drag={dragOver || undefined}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <p className="library__wordmark" aria-label="mark.">
        mark
        <img src={wordmarkDot} alt="" width={7} height={14} />
      </p>

      <header className="library__head">
        <h1 className="mk-heading-l">Your dances</h1>
        <button type="button" className="library__add" aria-label="Add a dance" onClick={pick}>
          <Icon name="add" size={24} />
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

      {dances.length === 0 ? (
        <div className="library__empty">
          <button type="button" className="dropzone" onClick={pick}>
            <span className="dropzone__icon">
              <Icon name="add" size={28} />
            </span>
            <span className="mk-heading-m">Add your first dance</span>
            <span className="mk-body-small">Pick a video or drop one here. It stays on your device.</span>
          </button>
          <Button variant="secondary" onClick={onRestoreDemo}>
            Try the demo
          </Button>
        </div>
      ) : (
        <>
          <p className="library__meta mk-label-mono">
            {dances.length} {dances.length === 1 ? 'dance' : 'dances'} · On this device
          </p>
          <ul className="library__grid">
            {dances.map((d) => (
              <DanceCard
                key={d.id}
                dance={d}
                menuOpen={menu === d.id}
                renaming={renaming === d.id}
                onOpen={() => onOpen(d.id)}
                onMenu={() => setMenu(menu === d.id ? null : d.id)}
                onCloseMenu={() => setMenu(null)}
                onStartRename={() => {
                  setMenu(null)
                  setRenaming(d.id)
                }}
                onRename={(name) => {
                  setRenaming(null)
                  if (name && name !== d.name) onRename(d.id, name)
                }}
                onChangeFrame={() => {
                  setMenu(null)
                  onChangeFrame(d.id)
                }}
                onChangeFirstBeat={() => {
                  setMenu(null)
                  onChangeFirstBeat(d.id)
                }}
                onFixCounts={() => {
                  setMenu(null)
                  onFixCounts(d.id)
                }}
                onDelete={() => {
                  setMenu(null)
                  onDelete(d.id)
                }}
              />
            ))}
          </ul>
        </>
      )}

      {menu && <button type="button" className="library__scrim" aria-label="Close menu" onClick={() => setMenu(null)} />}
    </main>
  )
}

type CardProps = {
  dance: Dance
  menuOpen: boolean
  renaming: boolean
  onOpen: () => void
  onMenu: () => void
  onCloseMenu: () => void
  onStartRename: () => void
  onRename: (name: string) => void
  onChangeFrame: () => void
  onChangeFirstBeat: () => void
  onFixCounts: () => void
  onDelete: () => void
}

function DanceCard({ dance: d, menuOpen, renaming, onOpen, onMenu, onCloseMenu, onStartRename, onRename, onChangeFrame, onChangeFirstBeat, onFixCounts, onDelete }: CardProps) {
  const thumb = useObjectUrl(d.thumb)
  const cardRef = useRef<HTMLLIElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuSide, setMenuSide] = useState<'left' | 'right'>('right')

  const closeRef = useRef(onCloseMenu)
  useEffect(() => {
    closeRef.current = onCloseMenu
  })
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const toggleMenu = () => {
    if (!menuOpen) {
      setConfirmDelete(false)
      // Open the menu towards the middle of the screen so it never clips.
      const r = cardRef.current!.getBoundingClientRect()
      setMenuSide(r.left + r.width / 2 < window.innerWidth / 2 ? 'left' : 'right')
    }
    onMenu()
  }

  // Show the part of the frame the dancer picked, mirrored if they mirror it.
  const thumbStyle: CSSProperties = {
    objectPosition: `${(d.mirror ? 1 - d.crop.x - d.crop.w / 2 : d.crop.x + d.crop.w / 2) * 100}% ${(d.crop.y + d.crop.h / 2) * 100}%`,
    transform: d.mirror ? 'scaleX(-1)' : undefined,
  }
  const meta = `${formatTime(d.duration)} · ${d.learned.length} of ${d.bars} learned`

  return (
    <li ref={cardRef} className="dance-card" data-menu={menuOpen || undefined}>
      <button type="button" className="dance-card__thumb" aria-label={`Open ${d.name}`} onClick={onOpen}>
        {thumb && <img src={thumb} alt="" style={thumbStyle} />}
      </button>
      {demoById(d.id) && <span className="dance-card__tag mk-glass mk-label-mono">Demo</span>}
      <button type="button" className="dance-card__more mk-glass" aria-label={`Options for ${d.name}`} aria-expanded={menuOpen} onClick={toggleMenu}>
        <Icon name="more" size={20} />
      </button>

      {renaming ? (
        <input
          className="dance-card__rename mk-body-strong"
          defaultValue={d.name}
          aria-label="Dance name"
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => onRename(e.currentTarget.value.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') onRename('')
          }}
        />
      ) : (
        <p className="dance-card__name mk-body-strong">{d.name}</p>
      )}
      <p className="dance-card__meta mk-data-mono">{meta}</p>

      {menuOpen && (
        <div className="card-menu" role="menu" data-side={menuSide}>
          <button type="button" role="menuitem" className="mk-body-strong" onClick={onStartRename}>
            Rename <Icon name="edit" size={20} />
          </button>
          <button type="button" role="menuitem" className="mk-body-strong" onClick={onChangeFirstBeat}>
            Move the 1 <Icon name="sound" size={20} />
          </button>
          <button type="button" role="menuitem" className="mk-body-strong" onClick={onFixCounts}>
            Redo counts <Icon name="restart" size={20} />
          </button>
          <button type="button" role="menuitem" className="mk-body-strong" onClick={onChangeFrame}>
            Change frame <Icon name="frame" size={20} />
          </button>
          <button
            type="button"
            role="menuitem"
            className="card-menu__danger mk-body-strong"
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          >
            {confirmDelete ? 'Tap again to delete' : 'Delete dance'} <Icon name="trash" size={20} />
          </button>
        </div>
      )}
    </li>
  )
}
