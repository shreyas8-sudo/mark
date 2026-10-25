import { useSyncExternalStore } from 'react'

// Spec: <768 portrait = phone screens; landscape phone (height < 500) = 09;
// ≥1024 = laptop / TV layouts 10 and 11.
export type Layout = 'portrait' | 'landscape' | 'desktop'

const LANDSCAPE = '(orientation: landscape) and (max-height: 500px)'
const DESKTOP = '(min-width: 1024px)'

function read(): Layout {
  if (matchMedia(LANDSCAPE).matches) return 'landscape'
  if (matchMedia(DESKTOP).matches) return 'desktop'
  return 'portrait'
}

function subscribe(onChange: () => void) {
  const queries = [matchMedia(LANDSCAPE), matchMedia(DESKTOP)]
  queries.forEach((q) => q.addEventListener('change', onChange))
  return () => queries.forEach((q) => q.removeEventListener('change', onChange))
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, read)
}
