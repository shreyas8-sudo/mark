import { useCallback, type Ref } from 'react'

/**
 * A ref for a <video> that frees its decoder when the element unmounts.
 * Safari keeps an unmounted video's media pipeline alive until GC and caps
 * how many it will run, so after a few screen changes (Learn ↔ Frame ↔
 * Rehearse) new videos render black. Also forwards to `forward`, if given.
 */
export function useVideoRef(src: string | undefined, forward?: Ref<HTMLVideoElement>) {
  return useCallback(
    (v: HTMLVideoElement | null) => {
      if (!v) return
      // StrictMode detaches and re-attaches refs: put back what cleanup removed.
      if (src && v.getAttribute('src') !== src) v.src = src
      setRef(forward, v)
      return () => {
        setRef(forward, null)
        v.pause()
        v.removeAttribute('src')
        v.load() // drops the buffered media now, not at GC
      }
    },
    [src, forward],
  )
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}
