// Whether the first-visit coach marks are done. Per-viewer convenience, so
// localStorage is fine; every access is guarded (private mode, blocked storage).
const STORAGE_KEY = 'mark.coachmarks.done'

export function coachMarksDone() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false // storage blocked: they'll simply show again next time
  }
}

export function markCoachMarksDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // storage blocked; nothing else to do
  }
}
