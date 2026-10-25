import { useEffect, useRef } from 'react'

type Handlers = Partial<Record<string, () => void>>

/**
 * Global keyboard shortcuts keyed by `KeyboardEvent.key` (letters are
 * matched case-insensitively). Ignored while typing in a text field, and
 * arrows are left alone on a focused slider so it still works.
 */
export function useKeys(handlers: Handlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const el = e.target as HTMLElement
      const isRange = el instanceof HTMLInputElement && el.type === 'range'
      if ((el instanceof HTMLInputElement && !isRange) || el instanceof HTMLTextAreaElement || el.isContentEditable) return
      if (isRange && e.key.startsWith('Arrow')) return

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const fn = ref.current[key]
      if (!fn) return
      // Also stops Space from "clicking" whichever button has focus.
      e.preventDefault()
      fn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
