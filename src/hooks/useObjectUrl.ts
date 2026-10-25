// One object URL per Blob for the life of the page. Revoking on unmount
// breaks under StrictMode's mount → unmount → mount (the memoised URL is
// dead on the second mount), so URLs are freed explicitly instead.
const urls = new WeakMap<Blob, string>()

export function objectUrl(blob: Blob) {
  let url = urls.get(blob)
  if (!url) {
    url = URL.createObjectURL(blob)
    urls.set(blob, url)
  }
  return url
}

/** Call when a Blob is discarded (e.g. its dance is deleted). */
export function revokeObjectUrl(blob: Blob) {
  const url = urls.get(blob)
  if (url) URL.revokeObjectURL(url)
  urls.delete(blob)
}

/** A stable URL for a Blob, or the string as-is. */
export function useObjectUrl(video: Blob | string | undefined) {
  return video instanceof Blob ? objectUrl(video) : video
}
